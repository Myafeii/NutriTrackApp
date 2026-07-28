using System.Net.Http.Headers;

var builder = WebApplication.CreateBuilder(args);

// Allow the frontend to be opened from other devices on the same Wi-Fi.
builder.WebHost.UseUrls("http://0.0.0.0:5200");

// Add Razor Pages.
builder.Services.AddRazorPages();

// Add session support.
builder.Services.AddDistributedMemoryCache();

builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromHours(2);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;

    // Helpful when testing through HTTP on your local network.
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
});

// Configure the NutriTrack backend API client.
builder.Services.AddHttpClient("NutriTrackApi", client =>
{
    var baseUrl =
        builder.Configuration["Backend:BaseUrl"]
        ?? "http://localhost:5000";

    client.BaseAddress = new Uri(baseUrl);

    client.DefaultRequestHeaders.Accept.Add(
        new MediaTypeWithQualityHeaderValue("application/json")
    );
});

builder.Services.AddScoped<
    NutriTrack.Frontend.Services.NutriTrackApiClient
>();

var app = builder.Build();

// Configure error handling.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

// Do not use HTTPS redirection while testing from your phone through
// http://192.168.40.171:5200.
// app.UseHttpsRedirection();

app.UseStaticFiles();

app.UseRouting();

app.UseSession();

// Require authentication for protected pages.
app.Use(async (context, next) =>
{
    var path =
        (context.Request.Path.Value ?? string.Empty)
        .ToLowerInvariant();

    var isAccountPage =
        path.StartsWith("/account");

    var isStaticFile =
        path.StartsWith("/css") ||
        path.StartsWith("/js") ||
        path.StartsWith("/lib") ||
        path.StartsWith("/images") ||
        path.StartsWith("/favicon");

    var uid =
        context.Session.GetString("uid");

    if (
        !isAccountPage &&
        !isStaticFile &&
        string.IsNullOrEmpty(uid)
    )
    {
        context.Response.Redirect("/Account/Login");
        return;
    }

    await next();
});

app.MapRazorPages();

app.Run();