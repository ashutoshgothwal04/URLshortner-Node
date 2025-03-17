import { readFile, writeFile } from "fs/promises";
import { createServer } from "http";
import path from "path";
import crypto from "crypto";

const PORT = 3001;
const DATA_FILE = path.join("data", "links.json");

const serveFile = async (res, filePath, contentType) => {
    try {
        const data = await readFile(filePath);
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
    } catch (error) {
        res.writeHead(404, { "Content-Type": "text/plain" }); // Fixed "text/plain"
        res.end("404 Not Found");
    }
};

const loadLinks = async () => {
    try {
        const data = await readFile(DATA_FILE, "utf-8");
        return JSON.parse(data);
    } catch (error) {
        if (error.code === "ENOENT") {
            console.log("File not found. Creating new links.json.");
            await writeFile(DATA_FILE, JSON.stringify({})); // Ensure file exists
            return {};
        }
        if (error instanceof SyntaxError) {
            console.error("Invalid JSON in links.json. Resetting file.");
            await writeFile(DATA_FILE, JSON.stringify({})); // Reset invalid JSON
            return {};
        }
        throw error; // Throw other unexpected errors
    }
};


const saveLinks = async (links) => {
    await writeFile(DATA_FILE, JSON.stringify(links, null));
};

const server = createServer(async (req, res) => {
    console.log(req.url);

    if (req.method === "GET") {
        if (req.url === "/") {
            return serveFile(res, path.join("public", "index.html"), "text/html");
        } else if (req.url === "/style.css") {
            return serveFile(res, path.join("public", "style.css"), "text/css");
        } else if (req.url === "/links") {
            const links = await loadLinks();
            console.log("Sending links:", links); // Debugging output
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(links));
        }
        else {
            const links = await loadLinks();
            const shortCode = req.url.split("?")[0].slice(1); // Extract path before query params
            
            console.log("Full request URL:", req.url);
             
            if (links[shortCode]) {
                console.log("Redirecting to:", links[shortCode]);
                res.writeHead(302, { Location: links[shortCode] });
                return res.end();
            }
        
            console.log("Shortcode not found!");
            res.writeHead(404, { "Content-Type": "text/plain" });
            return res.end("Shortened URL not found");
        }
        
        
        
    }

    if (req.method === "POST" && req.url === "/shorten") {
        let body = "";
    
        req.on("data", (chunk) => {
            body += chunk;
        });
    
        req.on("end", async () => {
            try {
                console.log("Received body:", body);
    
                if (!body) {
                    res.writeHead(400, { "Content-Type": "text/plain" });
                    return res.end("Request body is empty");
                }
    
                let parsedBody;
                try {
                    parsedBody = JSON.parse(body);
                } catch (error) {
                    res.writeHead(400, { "Content-Type": "text/plain" });
                    return res.end("Invalid JSON format");
                }
    
                const { url, shortcode } = parsedBody;
                if (!url) {
                    res.writeHead(400, { "Content-Type": "text/plain" });
                    return res.end("URL is required");
                }
    
                const links = await loadLinks();
                const finalShortCode = shortcode || crypto.randomBytes(4).toString("hex");
    
                if (links[finalShortCode]) {
                    res.writeHead(400, { "Content-Type": "text/plain" });
                    return res.end("Shortcode already exists. Please try again.");
                }
    
                links[finalShortCode] = url;
                await saveLinks(links);
    
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true, shortCode: finalShortCode }));
            } catch (err) {
                console.error("Server Error:", err);
                res.writeHead(500, { "Content-Type": "text/plain" });
                res.end("Internal Server Error");
            }
        });
    }
    
});

server.listen(PORT, () => {
    console.log(`Server is running on port localhost:${PORT}`);
});
