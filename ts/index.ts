const cors = require("cors");
import express, { Router } from "express";
import { PORT } from "./Constants";
import fetchMetadata from "url-metadata";

const corsOptions = {
  origin: function (origin: string, callback: (e: any, allowed?: boolean) => any) {
    callback(null, true);
  }
}

function addhttp(url: string) {
  if (!/^(?:f|ht)tps?\:\/\//.test(url)) {
      url = "http://" + url;
  }
  return url;
}

const app = express();
app.use(cors(corsOptions));

const API = Router();

API.get('/link/metadata', async function(req, res, next) {
  let { url } = req.query;

  if (!url) {
    return res.status(400).json({ success: 0, reason: { message: "Please provide a URL for the metadata query", code: "ERR_NO_URL" }})
  }

  url = addhttp(url);

  console.debug(`Fetching metadata for URL`, { url });

  const metadata = await fetchMetadata(url).catch(e => {
    console.error('Failed to load metadata for URL', e);
    return {
      title: null,
      description: null,
      image: null,
      "og:image": null,
      source: null
    }
  });

  if (metadata.source === null) {
    return res.status(400).json({ success: 0 });
  }

  const { title, description, image, "og:image": ogImage, source } = metadata;
  let imageURL = image || ogImage;
  if (imageURL && imageURL.startsWith('/')) {
    console.debug(`Prefixing relative image path with URL`, metadata);
    imageURL = addhttp(`${metadata.source}${imageURL}`);
  }

  res.json({
    success: 1,
    meta: {
      title,
      description,
      image: {
        url: imageURL
      }
    }
  })
});

app.use('/api/v1', API);

app.listen(PORT, () => console.log(`OpenNote API is running on :${PORT}`));