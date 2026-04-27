using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Models;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AppointmentController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AppointmentController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/appointment
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var data = await _context.Appointments
                .Include(a => a.Reminders)
                .Include(a => a.Participants)
                .OrderBy(a => a.StartTime)
                .ToListAsync();

            return Ok(data);
        }

        // GET: api/appointment/5
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var appointment = await _context.Appointments
                .Include(a => a.Reminders)
                .Include(a => a.Participants)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (appointment == null)
                return NotFound(new { message = "Không tìm thấy lịch hẹn" });

            return Ok(appointment);
        }

        // POST: api/appointment
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Appointment model)
        {
            if (model == null)
                return BadRequest(new { message = "Dữ liệu không hợp lệ" });

            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (string.IsNullOrWhiteSpace(model.Name))
                return BadRequest(new { message = "Tên lịch hẹn không được để trống" });

            if (model.StartTime >= model.EndTime)
                return BadRequest(new { message = "Giờ bắt đầu phải nhỏ hơn giờ kết thúc" });

            // Check trùng lịch
            var conflictAppointment = await _context.Appointments
                .FirstOrDefaultAsync(a =>
                    model.StartTime < a.EndTime &&
                    model.EndTime > a.StartTime);

            if (conflictAppointment != null)
            {
                // Nếu trùng với group meeting cùng tên + cùng duration
                var sameDuration = (model.EndTime - model.StartTime) == (conflictAppointment.EndTime - conflictAppointment.StartTime);

                if (conflictAppointment.IsGroupMeeting &&
                    conflictAppointment.Name.Trim().ToLower() == model.Name.Trim().ToLower() &&
                    sameDuration)
                {
                    return Conflict(new
                    {
                        message = "Lịch này trùng với một group meeting. Bạn có muốn join không?",
                        type = "group_meeting_conflict",
                        conflictId = conflictAppointment.Id
                    });
                }

                return Conflict(new
                {
                    message = "Lịch hẹn bị trùng thời gian. Vui lòng chọn thời gian khác hoặc thay thế lịch cũ.",
                    type = "time_conflict",
                    conflictId = conflictAppointment.Id
                });
            }

            _context.Appointments.Add(model);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Tạo lịch hẹn thành công",
                data = model
            });
        }

        // PUT: api/appointment/5
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Appointment model)
        {
            if (model == null)
                return BadRequest(new { message = "Dữ liệu không hợp lệ" });

            if (id != model.Id)
                return BadRequest(new { message = "Id không khớp" });

            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var existing = await _context.Appointments
                .Include(a => a.Reminders)
                .Include(a => a.Participants)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (existing == null)
                return NotFound(new { message = "Không tìm thấy lịch hẹn" });

            if (string.IsNullOrWhiteSpace(model.Name))
                return BadRequest(new { message = "Tên lịch hẹn không được để trống" });

            if (model.StartTime >= model.EndTime)
                return BadRequest(new { message = "Giờ bắt đầu phải nhỏ hơn giờ kết thúc" });

            var conflictAppointment = await _context.Appointments
                .FirstOrDefaultAsync(a =>
                    a.Id != id &&
                    model.StartTime < a.EndTime &&
                    model.EndTime > a.StartTime);

            if (conflictAppointment != null)
            {
                return Conflict(new
                {
                    message = "Lịch hẹn bị trùng với lịch khác",
                    type = "time_conflict",
                    conflictId = conflictAppointment.Id
                });
            }

            existing.Name = model.Name;
            existing.Location = model.Location;
            existing.StartTime = model.StartTime;
            existing.EndTime = model.EndTime;

            // Nếu chuyển từ group meeting sang cá nhân thì xóa participants để dữ liệu sạch hơn
            if (existing.IsGroupMeeting && !model.IsGroupMeeting)
            {
                _context.Participants.RemoveRange(existing.Participants);
            }

            existing.IsGroupMeeting = model.IsGroupMeeting;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Cập nhật lịch hẹn thành công",
                data = existing
            });
        }

        // DELETE: api/appointment/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var appointment = await _context.Appointments
                .Include(a => a.Reminders)
                .Include(a => a.Participants)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (appointment == null)
                return NotFound(new { message = "Không tìm thấy lịch hẹn" });

            _context.Reminders.RemoveRange(appointment.Reminders);
            _context.Participants.RemoveRange(appointment.Participants);
            _context.Appointments.Remove(appointment);

            await _context.SaveChangesAsync();

            return Ok(new { message = "Xóa lịch hẹn thành công" });
        }

        // POST: api/appointment/5/join-group
        [HttpPost("{id}/join-group")]
        public async Task<IActionResult> JoinGroup(int id, [FromBody] JoinGroupRequest request)
        {
            if (request == null)
                return BadRequest(new { message = "Dữ liệu không hợp lệ" });

            if (string.IsNullOrWhiteSpace(request.UserName))
                return BadRequest(new { message = "Tên người tham gia không được để trống" });

            var appointment = await _context.Appointments.FindAsync(id);
            if (appointment == null)
                return NotFound(new { message = "Không tìm thấy group meeting" });

            if (!appointment.IsGroupMeeting)
                return BadRequest(new { message = "Lịch này không phải group meeting" });

            var existingParticipant = await _context.Participants
                .FirstOrDefaultAsync(p =>
                    p.AppointmentId == id &&
                    p.UserName.Trim().ToLower() == request.UserName.Trim().ToLower());

            if (existingParticipant != null)
            {
                return Conflict(new
                {
                    message = "Người tham gia này đã tồn tại trong group meeting"
                });
            }

            var participant = new Participant
            {
                AppointmentId = id,
                UserName = request.UserName.Trim()
            };

            _context.Participants.Add(participant);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Đã thêm người tham gia vào group meeting",
                data = participant
            });
        }

        // POST: api/appointment/5/reminders
        [HttpPost("{id}/reminders")]
        public async Task<IActionResult> AddReminder(int id, [FromBody] ReminderRequest request)
        {
            if (request == null)
                return BadRequest(new { message = "Dữ liệu không hợp lệ" });

            var appointment = await _context.Appointments.FindAsync(id);
            if (appointment == null)
                return NotFound(new { message = "Không tìm thấy lịch hẹn" });

            if (request.ReminderTime == default)
                return BadRequest(new { message = "Thời gian nhắc không hợp lệ" });

            if (request.ReminderTime >= appointment.StartTime)
                return BadRequest(new { message = "Thời gian nhắc phải nhỏ hơn giờ bắt đầu" });

            var existingReminder = await _context.Reminders
                .FirstOrDefaultAsync(r =>
                    r.AppointmentId == id &&
                    r.ReminderTime == request.ReminderTime);

            if (existingReminder != null)
            {
                return Conflict(new
                {
                    message = "Reminder này đã tồn tại"
                });
            }

            var reminder = new Reminder
            {
                AppointmentId = id,
                ReminderTime = request.ReminderTime,
                Message = request.Message?.Trim()
            };

            _context.Reminders.Add(reminder);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Thêm reminder thành công",
                data = reminder
            });
        }
    }

    public class JoinGroupRequest
    {
        public string UserName { get; set; } = string.Empty;
    }

    public class ReminderRequest
    {
        public DateTime ReminderTime { get; set; }
        public string? Message { get; set; }
    }
}