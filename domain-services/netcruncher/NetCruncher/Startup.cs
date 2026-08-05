using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using NetCruncher.Services;

namespace NetCruncher
{
    public class Startup
    {
        public IConfiguration Configuration { get; }

        public Startup(IConfiguration configuration)
        {
            // Dependency injection for configuration
            Configuration = configuration;
        }

        public void ConfigureServices(IServiceCollection services)
        {
            // Add services to the container. These are used throughout the app.
            
            // Add framework services like MVC
            services.AddControllers();

            // Register custom services for file processing
            services.AddScoped<IFileService, FileService>();  // FileService is responsible for file processing logic
            
            // Add any other services here (e.g., for authentication, etc.)
        }

        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            // Configure the HTTP request pipeline.
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }
            else
            {
                app.UseExceptionHandler("/Home/Error");
                app.UseHsts();
            }

            app.UseHttpsRedirection();  // Force HTTPS
            app.UseStaticFiles();       // Serve static files (if you have any like logos, CSS, JS)
            
            app.UseRouting();

            // Use authentication middleware here if needed (e.g., for JWT or Keycloak integration)

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllers();  // Maps controllers to routes (API routes for your app)
            });
        }
    }
}
