# Byg
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY Madplan.sln .
COPY src/ src/
COPY tests/ tests/
RUN dotnet publish src/Madplan.Web -c Release -o /app --no-self-contained

# Kør
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .

# Databasen ligger på et volume, så den overlever en genstart af containeren.
ENV MADPLAN_DB_PATH=/data/madplan.db
ENV ASPNETCORE_URLS=http://+:8080
RUN mkdir -p /data
VOLUME /data
EXPOSE 8080

ENTRYPOINT ["dotnet", "Madplan.Web.dll"]
