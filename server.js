import express from "express";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const app = express();
const PORT = 3001;

// Fix for absolute paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, "data", "links.json");
const VIEWS_PATH = path.join(__dirname, "views", "index.html");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const loadLinks = async () => {
    try {
        const data = await readFile(DATA_FILE, "utf-8");
        return JSON.parse(data);
    } catch (error) {
        if (error.code === "ENOENT") {
            console.log("File not found. Creating new links.json.");
            await writeFile(DATA_FILE, JSON.stringify({}), "utf-8");
            return {};
        }
        if (error instanceof SyntaxError) {
            console.error("Invalid JSON in links.json. Resetting file.");
            await writeFile(DATA_FILE, JSON.stringify({}), "utf-8");
            return {};
        }
        throw error;
    }
};

const saveLinks = async (links) => {
    await writeFile(DATA_FILE, JSON.stringify(links, null, 2), "utf-8");
};

// Serve homepage with shortened URLs
app.get("/", async (req, res) => {
    try {
        const file = await readFile(VIEWS_PATH, "utf-8");
        const links = await loadLinks();

        const content = file.replaceAll(
            "{{Shortened-urls}}",
            Object.entries(links)
                .map(
                    ([shortCode, url]) =>
                        `<li><a href="/${shortCode}" target="_blank">${shortCode}</a> - ${url}</li>`
                )
                .join("")
        );

        return res.send(content);
    } catch (error) {
        console.error(error);
        return res.status(500).send("An error occurred!");
    }
});

// Handle URL shortening
app.post("/", async (req, res) => {
    try {
        const { url, shortCode } = req.body;
        if (!url) {
            return res.status(400).send("URL is required.");
        }

        const finalShortCode = shortCode || crypto.randomBytes(4).toString("hex");
        const links = await loadLinks();

        if (links[finalShortCode]) {
            return res.status(400).send("Shortcode already exists. Please try again.");
        }

        links[finalShortCode] = url;
        await saveLinks(links);

        console.log("Shortened URL Created:", { shortCode: finalShortCode, url });

        return res.redirect("/"); // 👈 Redirect clears form inputs
    } catch (error) {
        console.error(error);
        return res.status(500).send("An error occurred!");
    }
});


// Handle redirects
app.get("/:shortCode", async (req, res) => {
    try {
        const { shortCode } = req.params;
        const links = await loadLinks();

        if (!links[shortCode]) {
            return res.status(404).send("Shortcode not found.");
        }

        console.log("Redirecting:", shortCode, "->", links[shortCode]);
        return res.redirect(links[shortCode]); // 302 redirect
    } catch (error) {
        console.error(error);
        return res.status(500).send("An error occurred!");
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
