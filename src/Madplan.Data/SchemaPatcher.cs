using Microsoft.EntityFrameworkCore;

namespace Madplan.Data;

/// <summary>Tilføjer nye kolonner til en database der allerede findes.
///
/// Vi bruger <c>EnsureCreated</c>, som opretter skemaet første gang og derefter
/// ikke rører det. Det er nok så længe modellen ligger fast, men i det øjeblik
/// der kommer et felt til, står man med en database der mangler en kolonne — og
/// eneste udvej ville være at slette den og starte forfra. Det er en dårlig
/// aftale når den indeholder et halvt års madplaner.
///
/// Det her er ikke et migrationssystem, og det skal ikke blive til et. Kan man
/// ikke nøjes med at tilføje en kolonne med en standardværdi — omdøbninger,
/// ændrede typer, nye tabeller med relationer — så er det tid til EF Migrations.
/// Indtil da er dette både mindre og nemmere at gennemskue.</summary>
public static class SchemaPatcher
{
    /// <summary>Kolonner der er kommet til efter den første udgave.
    /// (tabel, kolonne, SQL-type og standardværdi)</summary>
    private static readonly (string Table, string Column, string Definition)[] Columns =
    [
        ("MealPlanEntries", "CoversDays", "INTEGER NOT NULL DEFAULT 1"),
        ("ProductMappings", "ProductUrl", "TEXT NULL"),
    ];

    public static async Task<int> ApplyAsync(MadplanDbContext db, CancellationToken ct = default)
    {
        var tilføjet = 0;

        foreach (var (table, column, definition) in Columns)
        {
            if (!await TableExistsAsync(db, table, ct)) continue;
            if (await ColumnExistsAsync(db, table, column, ct)) continue;

            // Tabel- og kolonnenavne kommer fra listen ovenfor, ikke fra input.
            await db.Database.ExecuteSqlRawAsync(
                $"ALTER TABLE {table} ADD COLUMN {column} {definition};", ct);
            tilføjet++;
        }

        return tilføjet;
    }

    private static async Task<bool> TableExistsAsync(MadplanDbContext db, string table, CancellationToken ct)
    {
        var connection = db.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
            await connection.OpenAsync(ct);

        await using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=$n;";
        var p = cmd.CreateParameter();
        p.ParameterName = "$n";
        p.Value = table;
        cmd.Parameters.Add(p);

        return Convert.ToInt32(await cmd.ExecuteScalarAsync(ct)) > 0;
    }

    private static async Task<bool> ColumnExistsAsync(
        MadplanDbContext db, string table, string column, CancellationToken ct)
    {
        var connection = db.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
            await connection.OpenAsync(ct);

        await using var cmd = connection.CreateCommand();
        cmd.CommandText = $"PRAGMA table_info({table});";

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            if (string.Equals(reader.GetString(1), column, StringComparison.OrdinalIgnoreCase))
                return true;

        return false;
    }
}
