# ----------------------
# Stage 1: Build
# ----------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy csproj and restore dependencies
COPY NetCruncher/ ./NetCruncher/
RUN dotnet restore ./NetCruncher/NetCruncher.csproj

# Copy all source files
COPY . .

# Publish the project
WORKDIR /src/NetCruncher
RUN dotnet publish NetCruncher.csproj -c Release -o /app/publish

# ----------------------
# Stage 2: Runtime
# ----------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# the base image defaults ASPNETCORE_HTTP_PORTS to 8080; make it explicit
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

# Copy published app from build stage
COPY --from=build /app/publish .

# Start the application
ENTRYPOINT ["dotnet", "NetCruncher.dll"]
