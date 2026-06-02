namespace NutriTrack.Frontend.Models;

public class MealItem
{
    public string? Id { get; set; }
    public string Food { get; set; } = "";
    public double Calories { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}
