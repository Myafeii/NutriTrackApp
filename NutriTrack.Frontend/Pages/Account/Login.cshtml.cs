using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Text;
using System.Text.Json;

namespace NutriTrack.Frontend.Pages.Account;

public class LoginModel : PageModel
{
    [BindProperty] public string Email { get; set; } = "";
    [BindProperty] public string Password { get; set; } = "";

    public string? Error { get; set; }

    public void OnGet()
    {
        var uid = HttpContext.Session.GetString("uid");

        if (!string.IsNullOrEmpty(uid))
        {
            Response.Redirect("/");
        }
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password))
        {
            Error = "Email and password are required.";
            return Page();
        }

        using var client = new HttpClient();

        var loginData = new
        {
            email = Email,
            password = Password
        };

        var json = JsonSerializer.Serialize(loginData);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await client.PostAsync("http://localhost:5000/login", content);

        if (!response.IsSuccessStatusCode)
        {
            Error = "Invalid email or password.";
            return Page();
        }

        var responseBody = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(responseBody);

        var uid = doc.RootElement.GetProperty("uid").GetString();
var email = doc.RootElement.GetProperty("email").GetString();
var name = doc.RootElement.GetProperty("name").GetString();

HttpContext.Session.SetString("uid", uid ?? "");
HttpContext.Session.SetString("email", email ?? "");
HttpContext.Session.SetString("name", name ?? "");

        return RedirectToPage("/Index");
    }
}