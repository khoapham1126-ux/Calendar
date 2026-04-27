using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication1.Models
{
    public class Reminder
    {
        public int Id { get; set; }

        [Required]
        public DateTime ReminderTime { get; set; }

        public string? Message { get; set; }

        public int AppointmentId { get; set; }

        [ForeignKey(nameof(AppointmentId))]
        public Appointment? Appointment { get; set; }
    }
}