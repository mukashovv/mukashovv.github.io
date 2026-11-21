export const photoTypes = ["image/jpeg", "image/png", "image/webp"];

const maxEdge = 700;
const quality = 0.82;

export class PhotoPreparationError extends Error {}

function encode(canvas, format, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, format, quality));
}

async function compressPhoto(image, sourceType) {
    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, maxEdge / longestEdge);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    try {
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas context unavailable");

        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const webp = await encode(canvas, "image/webp", quality);
        if (webp?.size && webp.type === "image/webp") return webp;

        // Preserve transparency when the browser cannot encode WebP.
        const fallbackType = sourceType === "image/jpeg" ? "image/jpeg" : "image/png";
        const fallback = await encode(canvas, fallbackType, quality);
        if (!fallback?.size || fallback.type !== fallbackType) throw new Error("Image encoding failed");
        return fallback;
    } finally {
        canvas.width = 0;
        canvas.height = 0;
    }
}

async function measureOutput(blob) {
    const url = URL.createObjectURL(blob);
    try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        if (!width || !height || Math.max(width, height) > maxEdge) {
            throw new PhotoPreparationError("Проверка размера не пройдена. Фото не отправлено.");
        }
        return { width, height };
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function preparePhoto(photo) {
    if (!photo?.size || !photoTypes.includes(photo.type)) {
        throw new PhotoPreparationError("Выберите изображение JPEG, PNG или WebP.");
    }

    const source = URL.createObjectURL(photo);
    try {
        const image = new Image();
        image.src = source;
        await image.decode();
        const { naturalWidth: width, naturalHeight: height } = image;
        if (!width || !height) throw new Error("Image has no dimensions");

        const orientation = width === height ? "square" : width > height ? "landscape" : "portrait";
        const blob = await compressPhoto(image, photo.type);
        const { width: outputWidth, height: outputHeight } = await measureOutput(blob);
        return { blob, orientation, width: outputWidth, height: outputHeight };
    } catch (error) {
        if (error instanceof PhotoPreparationError) throw error;
        throw new PhotoPreparationError("Не удалось подготовить изображение. Попробуйте выбрать другой файл.");
    } finally {
        URL.revokeObjectURL(source);
    }
}
