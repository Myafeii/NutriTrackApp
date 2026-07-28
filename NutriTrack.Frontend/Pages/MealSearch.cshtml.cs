using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using NutriTrack.Frontend.Models;
using NutriTrack.Frontend.Services;
using System.Net.Http.Headers;
using System.Text.Json;

namespace NutriTrack.Frontend.Pages;

public class MealSearchModel : PageModel
{
    private readonly NutriTrackApiClient _api;

    public MealSearchModel(NutriTrackApiClient api)
    {
        _api = api;
    }

    [BindProperty]
    public string Query { get; set; } = "";

    [BindProperty]
    public IFormFile? FoodImage { get; set; }

    public string? Message { get; set; }

    public string? UploadedImageBase64 { get; set; }

    public List<ResultItem> Results { get; set; } = new();

    public FoodResult? RecognizedFood { get; set; }

    public class ResultItem
    {
        public string Description { get; set; } = "";

        public double Calories { get; set; }
    }

    public class FoodResult
    {
        public string? DetectedFood { get; set; }

        public double Calories { get; set; }

        public double Protein { get; set; }

        public double Carbs { get; set; }

        public double Fat { get; set; }
    }

    public IActionResult OnGet()
    {
        var uid = HttpContext.Session.GetString("uid");

        if (string.IsNullOrWhiteSpace(uid))
        {
            return RedirectToPage("/Account/Login");
        }

        return Page();
    }

    public async Task<IActionResult> OnPostSearchAsync()
    {
        var uid = HttpContext.Session.GetString("uid");

        if (string.IsNullOrWhiteSpace(uid))
        {
            return RedirectToPage("/Account/Login");
        }

        if (string.IsNullOrWhiteSpace(Query))
        {
            Message = "Please enter a food name.";
            return Page();
        }

        using var doc = await _api.SearchNutritionAsync(Query);

        if (doc == null)
        {
            Message =
                "Nutrition search failed. Make sure the backend and USDA service are running.";

            return Page();
        }

        if (!doc.RootElement.TryGetProperty(
                "foods",
                out var foods) ||
            foods.ValueKind != JsonValueKind.Array)
        {
            Message = "No foods found.";
            return Page();
        }

        Results = foods
            .EnumerateArray()
            .Take(10)
            .Select(food => new ResultItem
            {
                Description =
                    food.TryGetProperty(
                        "description",
                        out var descriptionElement)
                        ? descriptionElement.GetString() ?? "Food"
                        : "Food",

                Calories = TryGetCalories(food)
            })
            .ToList();

        if (Results.Count == 0)
        {
            Message = "No results found.";
        }

        return Page();
    }

    public async Task<IActionResult> OnPostRecognizeFoodAsync()
    {
        var uid = HttpContext.Session.GetString("uid");

        if (string.IsNullOrWhiteSpace(uid))
        {
            return RedirectToPage("/Account/Login");
        }

        if (FoodImage == null || FoodImage.Length == 0)
        {
            Message = "Please upload a food image.";
            return Page();
        }

        try
        {
            using var memoryStream = new MemoryStream();

            await FoodImage.CopyToAsync(memoryStream);

            UploadedImageBase64 =
                $"data:{FoodImage.ContentType};base64," +
                Convert.ToBase64String(memoryStream.ToArray());

            memoryStream.Position = 0;

            using var client = new HttpClient();
            using var formData = new MultipartFormDataContent();

            using var fileContent =
                new StreamContent(memoryStream);

            fileContent.Headers.ContentType =
                new MediaTypeHeaderValue(
                    FoodImage.ContentType
                );

            formData.Add(
                fileContent,
                "image",
                FoodImage.FileName
            );

            var response = await client.PostAsync(
                "http://localhost:5000/recognize-food",
                formData
            );

            if (!response.IsSuccessStatusCode)
            {
                Message =
                    "Food recognition failed. Make sure the backend is running.";

                return Page();
            }

            var json =
                await response.Content.ReadAsStringAsync();

            RecognizedFood =
                JsonSerializer.Deserialize<FoodResult>(
                    json,
                    new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    }
                );

            if (RecognizedFood == null)
            {
                Message =
                    "Could not read the AI recognition result.";
            }
        }
        catch (HttpRequestException)
        {
            Message =
                "Unable to connect to the food recognition backend.";
        }
        catch (Exception ex)
        {
            Message = "Error: " + ex.Message;
        }

        return Page();
    }

    public async Task<IActionResult> OnPostAddAsync(
        string food,
        double calories)
    {
        var uid =
            HttpContext.Session.GetString("uid") ?? "";

        if (string.IsNullOrWhiteSpace(uid))
        {
            return RedirectToPage("/Account/Login");
        }

        if (string.IsNullOrWhiteSpace(food))
        {
            Message = "Food name is required.";
            return Page();
        }

        if (calories < 0)
        {
            Message = "Calories cannot be negative.";
            return Page();
        }

        var (ok, mealId, err) =
            await _api.SaveMealAsync(
                new MealRequest
                {
                    Uid = uid,
                    Food = food,
                    Calories = calories
                }
            );

        if (!ok)
        {
            Message = "Save failed: " + err;
            return Page();
        }

        var meals =
            HttpContext.Session
                .GetObject<List<MealItem>>("meals")
            ?? new List<MealItem>();

        meals.Add(
            new MealItem
            {
                Id = mealId,
                Food = food,
                Calories = calories,
                CreatedAt = DateTime.Now
            }
        );

        HttpContext.Session.SetObject(
            "meals",
            meals
        );

        return RedirectToPage("/Index");
    }

    public async Task<IActionResult> OnGetBarcodeAsync(
        string barcode)
    {
        var uid = HttpContext.Session.GetString("uid");

        if (string.IsNullOrWhiteSpace(uid))
        {
            return new JsonResult(
                new
                {
                    success = false,
                    error =
                        "Your session has expired. Please log in again."
                }
            );
        }

        if (string.IsNullOrWhiteSpace(barcode))
        {
            return new JsonResult(
                new
                {
                    success = false,
                    error = "Barcode is required."
                }
            );
        }

        barcode = new string(
            barcode
                .Where(char.IsDigit)
                .ToArray()
        );

        if (string.IsNullOrWhiteSpace(barcode))
        {
            return new JsonResult(
                new
                {
                    success = false,
                    error =
                        "Please enter a valid numeric barcode."
                }
            );
        }

        try
        {
            using var client = new HttpClient();

            var response = await client.GetAsync(
                $"http://localhost:5000/barcode/{barcode}"
            );

            var responseBody =
                await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                var errorMessage =
                    "Product not found.";

                try
                {
                    using var errorDocument =
                        JsonDocument.Parse(
                            responseBody
                        );

                    if (
                        errorDocument.RootElement
                            .TryGetProperty(
                                "error",
                                out var errorElement
                            )
                    )
                    {
                        errorMessage =
                            errorElement.GetString()
                            ?? errorMessage;
                    }
                }
                catch
                {
                    // Keep the default error message.
                }

                return new JsonResult(
                    new
                    {
                        success = false,
                        error = errorMessage
                    }
                );
            }

            using var productDocument =
                JsonDocument.Parse(
                    responseBody
                );

            return new JsonResult(
                new
                {
                    success = true,
                    product =
                        productDocument
                            .RootElement
                            .Clone()
                }
            );
        }
        catch (HttpRequestException)
        {
            return new JsonResult(
                new
                {
                    success = false,
                    error =
                        "The NutriTrack backend is not running."
                }
            );
        }
        catch (JsonException)
        {
            return new JsonResult(
                new
                {
                    success = false,
                    error =
                        "The barcode service returned invalid product data."
                }
            );
        }
        catch (Exception ex)
        {
            Console.WriteLine(
                $"Barcode lookup error: {ex.Message}"
            );

            return new JsonResult(
                new
                {
                    success = false,
                    error =
                        "Unable to retrieve product information."
                }
            );
        }
    }

    private static double TryGetCalories(
        JsonElement food)
    {
        if (
            !food.TryGetProperty(
                "foodNutrients",
                out var nutrients
            ) ||
            nutrients.ValueKind !=
            JsonValueKind.Array
        )
        {
            return 0;
        }

        foreach (var nutrient
                 in nutrients.EnumerateArray())
        {
            var name =
                nutrient.TryGetProperty(
                    "nutrientName",
                    out var nameElement
                )
                    ? nameElement.GetString() ?? ""
                    : "";

            var unit =
                nutrient.TryGetProperty(
                    "unitName",
                    out var unitElement
                )
                    ? unitElement.GetString() ?? ""
                    : "";

            if (
                name.Contains(
                    "Energy",
                    StringComparison.OrdinalIgnoreCase
                ) &&
                unit.Contains(
                    "KCAL",
                    StringComparison.OrdinalIgnoreCase
                )
            )
            {
                if (
                    nutrient.TryGetProperty(
                        "value",
                        out var valueElement
                    ) &&
                    valueElement.TryGetDouble(
                        out var calories
                    )
                )
                {
                    return calories;
                }
            }
        }

        return 0;
    }
}