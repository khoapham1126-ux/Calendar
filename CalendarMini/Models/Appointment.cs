using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models
{
    public class Appointment
    {
        public int Id { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        public string? Location { get; set; }

        [Required]
        public DateTime StartTime { get; set; }

        [Required]
        public DateTime EndTime { get; set; }

        public bool IsGroupMeeting { get; set; }

        public ICollection<Reminder> Reminders { get; set; } = new List<Reminder>();
        public ICollection<Participant> Participants { get; set; } = new List<Participant>();
    }
}