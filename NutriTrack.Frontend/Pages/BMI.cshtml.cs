using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace NutriTrackFrontend.Pages
{
    public class BMIModel : PageModel
    {
        [BindProperty]
        public double Height { get; set; }

        [BindProperty]
        public double Weight { get; set; }

        public double BMI { get; set; }

        public string Category { get; set; } = "";

        public string Suggestion { get; set; } = "";

        public string ErrorMessage { get; set; } = "";

        public void OnGet()
        {
        }

        public IActionResult OnPost()
        {
            if (Height <= 0 || Weight <= 0)
            {
                ErrorMessage = "Please enter valid height and weight.";
                return Page();
            }

            double heightInMeters = Height / 100;

            BMI = Math.Round(
                Weight / (heightInMeters * heightInMeters),
                1
            );

            Category = GetBMICategory(BMI);

            Suggestion = GetSuggestion(Category);

            return Page();
        }

        private string GetBMICategory(double bmi)
        {
            if (bmi < 18.5)
            {
                return "Underweight";
            }
            else if (bmi < 25)
            {
                return "Normal Weight";
            }
            else if (bmi < 30)
            {
                return "Overweight";
            }
            else
            {
                return "Obese";
            }
        }

        private string GetSuggestion(string category)
        {
            switch (category)
            {
                case "Underweight":
                    return "Increase healthy calorie and protein intake.";

                case "Normal Weight":
                    return "Great job! Maintain your healthy lifestyle.";

                case "Overweight":
                    return "Monitor calories and increase physical activity.";

                case "Obese":
                    return "Consider a structured nutrition and fitness plan.";

                default:
                    return "";
            }
        }
    }
}