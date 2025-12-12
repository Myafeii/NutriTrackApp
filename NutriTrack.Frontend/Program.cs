using System.Net.Http.Headers;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls("http://localhost:5200");


// Add services to the container.
builder.Services.AddRazorPages();


builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromHours(2);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});


builder.Services.AddHttpClient("NutriTrackApi", client =>
{
    var baseUrl = builder.Configuration["Backend:BaseUrl"] ?? "http://localhost:5000";
    client.BaseAddress = new Uri(baseUrl);
    client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
});

builder.Services.AddScoped<NutriTrack.Frontend.Services.NutriTrackApiClient>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseSession();

app.Use(async (context, next) =>
{
    var path = (context.Request.Path.Value ?? "").ToLower();
    var isAccount = path.StartsWith("/account");
    var isStatic = path.StartsWith("/css") || path.StartsWith("/js") || path.StartsWith("/lib") || path.StartsWith("/favicon");

    var uid = context.Session.GetString("uid");

    if (!isAccount && !isStatic && string.IsNullOrEmpty(uid))
    {
        context.Response.Redirect("/Account/Login");
        return;
    }

    await next();
});

app.MapRazorPages();
app.Run();
