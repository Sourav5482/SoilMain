import axios from "axios";
import { Platform } from "react-native";
import { API_BASE_URL } from "../constants/config";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000
});

const UPLOAD_TIMEOUT_MS = 45000;

const uploadWithTimeout = async (formData, timeoutMs) => {
  const controller = new AbortController();
  const timerId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(`${API_BASE_URL}/upload-images`, {
      method: "POST",
      headers: {
        Accept: "application/json"
      },
      body: formData,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Upload timed out after ${Math.floor(timeoutMs / 1000)} seconds`);
    }
    throw error;
  } finally {
    clearTimeout(timerId);
  }
};

const normalizeImagePart = (image, index) => {
  const uri = image?.uri;
  if (!uri) {
    throw new Error("Image URI is missing");
  }

  const uriWithoutQuery = String(uri).split("?")[0];
  const extMatch = uriWithoutQuery.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch?.[1]?.toLowerCase() || "jpg";
  const normalizedExt = ext === "jpg" ? "jpeg" : ext;
  const fileName = image.fileName || `soil-image-${Date.now()}-${index}.${ext}`;
  const mimeType = image.type && image.type.includes("/") ? image.type : `image/${normalizedExt}`;

  return {
    uri: Platform.OS === "ios" ? uri : uri,
    type: mimeType,
    name: fileName
  };
};

const uploadSingleImage = async (image, index) => {
  const data = new FormData();
  data.append("images", normalizeImagePart(image, index));

  // Use fetch for multipart in React Native to avoid axios adapter network errors.
  const response = await uploadWithTimeout(data, UPLOAD_TIMEOUT_MS);

  const rawText = await response.text();
  let payload = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    const serverMessage = payload?.message || `Upload failed with status ${response.status}`;
    throw new Error(serverMessage);
  }

  const urls = payload?.images;
  if (!Array.isArray(urls) || !urls.length) {
    throw new Error("Upload succeeded but no image URL returned");
  }

  return urls[0];
};

export const uploadImagesApi = async (images) => {
  if (!Array.isArray(images) || !images.length) {
    return [];
  }

  const uploadedUrls = [];

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];

    try {
      const url = await uploadSingleImage(image, index);
      uploadedUrls.push(url);
    } catch (firstError) {
      try {
        // Retry once for transient mobile network/cold-start issues.
        const url = await uploadSingleImage(image, index);
        uploadedUrls.push(url);
      } catch (secondError) {
        const fallbackMessage = secondError?.message || firstError?.message || "Failed to upload image";
        throw new Error(`Image ${index + 1} upload failed: ${fallbackMessage}`);
      }
    }
  }

  return uploadedUrls;
};

export const saveSoilDataApi = async (payload) => {
  const response = await api.post("/save-data", payload);
  return response.data;
};

export const getHistoryByRefIdApi = async (refId) => {
  const response = await api.get(`/history/ref/${encodeURIComponent(refId)}`);
  return response.data;
};

export const getHistoryByLocationApi = async (location) => {
  const response = await api.get(`/history/location/${encodeURIComponent(location)}`);
  return response.data;
};

export const getAllRefIdsApi = async () => {
  const response = await api.get("/history/refs");
  return response.data;
};
