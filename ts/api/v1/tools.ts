import { Router, Request, Response } from "express";
import fetchMetadata from "url-metadata";
import { Get, RespondsWithJSON, RouteGroup, JSONResponse } from "../../route.kit";

function addhttp(url: string) {
  if (!/^(?:f|ht)tps?\:\/\//.test(url)) {
    url = "http://" + url;
  }
  return url;
}

@RouteGroup('/tools')
export class ToolsAPI_V1 {
  @Get('/link/metadata', RespondsWithJSON)
  async linkMetadata(req: Request, res: Response) {
    let { url } = req.query;

    if (!url) {
      return res.status(400).json({ success: 0, reason: { message: "Please provide a URL for the metadata query", code: "ERR_NO_URL" } })
    }

    url = addhttp(url);

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
      return new JSONResponse({success: 0}, 400);
    }

    const { title, description, image, "og:image": ogImage, source } = metadata;
    let imageURL = image || ogImage;
    if (imageURL && imageURL.startsWith('/')) {
      imageURL = addhttp(`${metadata.source}${imageURL}`);
    }

    return {
      success: 1,
      meta: {
        title,
        description,
        image: {
          url: imageURL
        }
      }
    };
  }
}