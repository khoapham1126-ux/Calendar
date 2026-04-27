using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication1.Models
{
    public class Participant
    {
        public int Id { get; set; }

        [Required]
        public string UserName { get; set; } = string.Empty;

        public int AppointmentId { get; set; }

        [ForeignKey(nameof(AppointmentId))]
        public Appointment? Appointment { get; set; }
    }
}