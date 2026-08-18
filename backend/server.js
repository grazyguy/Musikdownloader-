import express from "express";
import cors from "cors";
import multer from "multer";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

const TMP_DIR = path.join(os.tmpdir(), "mediaforge");

if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
}

const upload = multer({
    dest: TMP_DIR
});

/*
=========================================================
TOOLS
=========================================================
*/

async function checkTool(command, args = ["--version"]) {
    try {
        const result = await execFileAsync(command, args);

        return {
            available: true,
            exitCode: 0,
            output: (result.stdout || result.stderr || "").trim()
        };
    } catch (error) {
        return {
            available: false,
            exitCode: error.code || 1,
            output: (error.stdout || error.stderr || error.message || "").trim()
        };
    }
}

async function findCommand(command) {
    try {
        const { stdout } = await execFileAsync(
            "sh",
            ["-c", `command -v ${command}`]
        );

        return stdout.trim();
    } catch {
        return null;
    }
}

/*
=========================================================
STATUS
=========================================================
*/

app.get("/", (req, res) => {
    res.json({
        success: true,
        service: "MediaForge API",
        status: "online",
        ytDlp: true,
        ffmpeg: true,
        deno: true
    });
});

app.get("/api/status", async (req, res) => {

    const ytDlp = await checkTool("yt-dlp");
    const ffmpeg = await checkTool("ffmpeg", ["-version"]);
    const deno = await checkTool("deno");

    res.json({
        success: true,
        tools: {
            "yt-dlp": ytDlp,
            ffmpeg: ffmpeg,
            deno: deno
        }
    });
});

/*
=========================================================
URL VALIDIERUNG
=========================================================
*/

function isAllowedUrl(input) {

    try {

        const parsed = new URL(input);

        if (
            parsed.protocol !== "http:" &&
            parsed.protocol !== "https:"
        ) {
            return false;
        }

        const hostname =
            parsed.hostname.toLowerCase();

        const allowedHosts = [
            "youtube.com",
            "www.youtube.com",
            "m.youtube.com",
            "youtu.be",
            "music.youtube.com",

            "tiktok.com",
            "www.tiktok.com",
            "vm.tiktok.com",
            "vt.tiktok.com",

            "instagram.com",
            "www.instagram.com"
        ];

        return allowedHosts.some(host =>
            hostname === host ||
            hostname.endsWith("." + host)
        );

    } catch {
        return false;
    }
}

/*
=========================================================
DATEINAME
=========================================================
*/

function cleanFilename(filename) {

    let name =
        String(filename || "mediaforge-download")
            .trim()
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-");

    if (!name) {
        name = "mediaforge-download";
    }

    return name.substring(0, 100);
}

/*
=========================================================
FORMAT
=========================================================
*/

const allowedFormats = [
    "mp3",
    "mp4",
    "m4a",
    "wav",
    "flac",
    "aac",
    "ogg"
];

function getExtension(format) {

    if (format === "mp3") return "mp3";
    if (format === "mp4") return "mp4";
    if (format === "m4a") return "m4a";
    if (format === "wav") return "wav";
    if (format === "flac") return "flac";
    if (format === "aac") return "aac";
    if (format === "ogg") return "ogg";

    return "mp3";
}

/*
=========================================================
CONTENT TYPE
=========================================================
*/

function getContentType(extension) {

    const types = {
        mp3: "audio/mpeg",
        mp4: "video/mp4",
        m4a: "audio/mp4",
        wav: "audio/wav",
        flac: "audio/flac",
        aac: "audio/aac",
        ogg: "audio/ogg"
    };

    return types[extension] ||
        "application/octet-stream";
}

/*
=========================================================
CONVERT
=========================================================
*/

app.post(
    "/api/convert",
    upload.none(),
    async (req, res) => {

        const url =
            String(req.body.url || "").trim();

        const format =
            String(req.body.format || "mp3")
                .toLowerCase();

        const quality =
            String(
                req.body.audioQuality ||
                req.body.quality ||
                "192"
            );

        const requestedFilename =
            cleanFilename(
                req.body.filename
            );

        /*
        -------------------------------------------------
        VALIDIERUNG
        -------------------------------------------------
        */

        if (!url) {

            return res.status(400).json({
                success: false,
                error: "Keine URL angegeben."
            });

        }

        if (!isAllowedUrl(url)) {

            return res.status(400).json({
                success: false,
                error:
                    "Diese URL wird nicht unterstützt. Bitte verwende eine öffentliche URL von YouTube, TikTok oder Instagram."
            });

        }

        if (!allowedFormats.includes(format)) {

            return res.status(400).json({
                success: false,
                error: "Dieses Format wird nicht unterstützt."
            });

        }

        const extension =
            getExtension(format);

        const id =
            crypto.randomBytes(12).toString("hex");

        const workDir =
            path.join(TMP_DIR, id);

        fs.mkdirSync(workDir, {
            recursive: true
        });

        const outputBase =
            path.join(
                workDir,
                "mediaforge"
            );

        const finalFilename =
            `${requestedFilename}.${extension}`;

        const finalPath =
            path.join(
                workDir,
                finalFilename
            );

        try {

            /*
            -------------------------------------------------
            YT-DLP ARGUMENTE
            -------------------------------------------------
            */

            const args = [
                "--no-playlist",
                "--no-warnings",
                "--restrict-filenames",
                "--output",
                `${outputBase}.%(ext)s`
            ];

            /*
            -------------------------------------------------
            AUDIO
            -------------------------------------------------
            */

            if (format !== "mp4") {

                args.push(
                    "--extract-audio",
                    "--audio-format",
                    format
                );

                /*
                WAV / FLAC brauchen keine Bitrate.
                */

                if (
                    format === "mp3" ||
                    format === "m4a" ||
                    format === "aac" ||
                    format === "ogg"
                ) {

                    args.push(
                        "--audio-quality",
                        `${quality}K`
                    );

                }

            } else {

                /*
                -------------------------------------------------
                VIDEO MP4
                -------------------------------------------------
                */

                args.push(
                    "--merge-output-format",
                    "mp4"
                );

            }

            args.push(url);

            /*
            -------------------------------------------------
            DOWNLOAD
            -------------------------------------------------
            */

            await execFileAsync(
                "yt-dlp",
                args,
                {
                    cwd: workDir,
                    maxBuffer: 1024 * 1024 * 10
                }
            );

            /*
            -------------------------------------------------
            DATEI SUCHEN
            -------------------------------------------------
            */

            const files =
                fs.readdirSync(workDir);

            const mediaFile =
                files.find(file =>
                    file !== finalFilename &&
                    /\.(mp3|mp4|m4a|wav|flac|aac|ogg)$/i.test(file)
                );

            if (!mediaFile) {

                throw new Error(
                    "Die konvertierte Datei wurde nicht gefunden."
                );

            }

            const generatedPath =
                path.join(
                    workDir,
                    mediaFile
                );

            /*
            -------------------------------------------------
            DATEI AUF FINALEN NAMEN VERSCHIEBEN
            -------------------------------------------------
            */

            fs.renameSync(
                generatedPath,
                finalPath
            );

            const stats =
                fs.statSync(finalPath);

            const sizeMB =
                (
                    stats.size /
                    1024 /
                    1024
                ).toFixed(2);

            /*
            -------------------------------------------------
            DOWNLOAD-ID
            -------------------------------------------------
            */

            const downloadId =
                crypto.randomBytes(16).toString("hex");

            /*
            -------------------------------------------------
            TEMPORÄRE DOWNLOAD-DATEI SPEICHERN
            -------------------------------------------------
            */

            const downloadDir =
                path.join(
                    TMP_DIR,
                    "downloads"
                );

            if (!fs.existsSync(downloadDir)) {
                fs.mkdirSync(downloadDir, {
                    recursive: true
                });
            }

            const downloadPath =
                path.join(
                    downloadDir,
                    `${downloadId}-${finalFilename}`
                );

            fs.copyFileSync(
                finalPath,
                downloadPath
            );

            /*
            -------------------------------------------------
            URL ZUM DOWNLOAD
            -------------------------------------------------
            */

            const protocol =
                req.headers["x-forwarded-proto"] ||
                req.protocol;

            const host =
                req.get("host");

            const downloadUrl =
                `${protocol}://${host}/api/download/${encodeURIComponent(
                    downloadId
                )}/${encodeURIComponent(
                    finalFilename
                )}`;

            /*
            -------------------------------------------------
            ANTWORT
            -------------------------------------------------
            */

            res.json({
                success: true,
                filename: finalFilename,
                format: extension,
                size: `${sizeMB} MB`,
                downloadUrl: downloadUrl
            });

            /*
            -------------------------------------------------
            WORKDIR LÖSCHEN
            -------------------------------------------------
            */

            setTimeout(() => {

                try {
                    fs.rmSync(workDir, {
                        recursive: true,
                        force: true
                    });
                } catch {}

            }, 5000);

        } catch (error) {

            console.error(
                "MediaForge conversion error:",
                error
            );

            try {
                fs.rmSync(workDir, {
                    recursive: true,
                    force: true
                });
            } catch {}

            res.status(500).json({
                success: false,
                error:
                    "Download/Umwandlung fehlgeschlagen.",
                details:
                    error.message || "Unbekannter Fehler."
            });

        }

    }
);

/*
=========================================================
DOWNLOAD ENDPOINT
=========================================================
*/

app.get(
    "/api/download/:id/:filename",
    async (req, res) => {

        const id =
            String(req.params.id);

        const filename =
            cleanFilename(
                decodeURIComponent(
                    req.params.filename
                )
            );

        const downloadDir =
            path.join(
                TMP_DIR,
                "downloads"
            );

        const files =
            fs.readdirSync(downloadDir);

        const matchingFile =
            files.find(file =>
                file.startsWith(id + "-")
            );

        if (!matchingFile) {

            return res.status(404).send(
                "Datei nicht mehr verfügbar."
            );

        }

        const filePath =
            path.join(
                downloadDir,
                matchingFile
            );

        /*
        -------------------------------------------------
        SAFARI / IPHONE DOWNLOAD
        -------------------------------------------------
        */

        const extension =
            path.extname(filename)
                .replace(".", "")
                .toLowerCase();

        res.setHeader(
            "Content-Type",
            getContentType(extension)
        );

        /*
        WICHTIG:
        attachment sorgt dafür,
        dass der Browser die Datei
        als Download behandelt.
        */

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
        );

        res.setHeader(
            "Content-Length",
            fs.statSync(filePath).size
        );

        res.setHeader(
            "Cache-Control",
            "no-store"
        );

        res.setHeader(
            "X-Content-Type-Options",
            "nosniff"
        );

        res.sendFile(
            path.resolve(filePath),
            error => {

                if (error) {
                    console.error(
                        "Download error:",
                        error
                    );
                }

            }
        );

        /*
        -------------------------------------------------
        DATEI NACH EINIGER ZEIT LÖSCHEN
        -------------------------------------------------
        */

        setTimeout(() => {

            try {

                if (
                    fs.existsSync(filePath)
                ) {

                    fs.unlinkSync(
                        filePath
                    );

                }

            } catch {}

        }, 10 * 60 * 1000);

    }
);

/*
=========================================================
SERVER
=========================================================
*/

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `MediaForge API läuft auf Port ${PORT}`
        );

        console.log(
            `Port: ${PORT}`
        );

    }
);