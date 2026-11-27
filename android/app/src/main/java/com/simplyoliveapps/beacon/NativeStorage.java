package com.simplyoliveapps.beacon;

import android.content.Context;
import android.database.Cursor;
import java.io.File;
import net.zetetic.database.sqlcipher.SQLiteDatabase;
import org.json.JSONArray;
import org.json.JSONObject;

/** Reads/writes the same Capacitor SQLite key-value store used by StorageService. */
final class NativeStorage implements AutoCloseable {
    private static final String DATABASE_NAME = "beacon_storageSQLite.db";
    private final SQLiteDatabase database;

    NativeStorage(Context context) {
        System.loadLibrary("sqlcipher");
        File file = context.getDatabasePath(DATABASE_NAME);
        if (!file.exists()) {
            throw new IllegalStateException("App storage database does not exist");
        }
        // StorageService currently creates this database with encrypted=false.
        // The empty SQLCipher key opens that unencrypted SQLite database in place.
        database = SQLiteDatabase.openDatabase(
            file.getAbsolutePath(),
            "",
            null,
            SQLiteDatabase.OPEN_READWRITE,
            null
        );
    }

    JSONObject getJson(String key) throws Exception {
        try (Cursor cursor = database.rawQuery("SELECT value FROM kv_store WHERE key = ?", new String[] { key })) {
            if (!cursor.moveToFirst()) return null;
            return new JSONObject(cursor.getString(0));
        }
    }

    JSONArray getJsonArray(String key) throws Exception {
        try (Cursor cursor = database.rawQuery("SELECT value FROM kv_store WHERE key = ?", new String[] { key })) {
            if (!cursor.moveToFirst()) return new JSONArray();
            return new JSONArray(cursor.getString(0));
        }
    }

    void setJson(String key, JSONObject value) {
        database.execSQL(
            "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)",
            new Object[] { key, value.toString() }
        );
    }

    @Override
    public void close() {
        database.close();
    }
}