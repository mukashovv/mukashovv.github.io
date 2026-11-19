export const photoTypes = ["image/jpeg", "image/png", "image/webp"];

const originalMaxEdge = 800;
const originalMaxBytes = 150 * 1024;
const maxEdge = 2400;
const targetBytes = 1.5 * 1024 * 1024;
const storageLimit = 5 * 1024 * 1024;
const minEdge = 512;

export class PhotoPreparationError extends Error {}

function encode(canvas, format, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, format, quality));
}

async function compressPhoto(image, photo) {
    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
    if (photo.size <= storageLimit && (longestEdge <= originalMaxEdge || photo.size <= originalMaxBytes)) {
        return photo;
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context unavailable");

    let edge = Math.min(longestEdge, maxEdge);
    let format = "image/webp";
    try {
        while (true) {
            const scale = edge / longestEdge;
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            context.imageSmoothingQuality = "high";
            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            let result = await encode(canvas, format, 0.88);
            if (!result || (format === "image/webp" && result.type !== format)) {
                format = photo.type === "image/jpeg" ? "image/jpeg" : "image/png";
                result = await encode(canvas, format, 0.88);
            }
            if (!result?.size || !photoTypes.includes(result.type)) throw new Error("Image encoding failed");

            if (result.size > targetBytes && format !== "image/png") {
                const smaller = await encode(canvas, format, 0.74);
                if (smaller?.size && smaller.type === format && smaller.size < result.size) result = smaller;
            }

            if (longestEdge <= maxEdge && photo.size <= storageLimit && photo.size <= result.size) return photo;
            if (result.size <= targetBytes || (edge <= minEdge && result.size <= storageLimit)) return result;
            if (edge <= minEdge) throw new Error("Compressed image exceeds storage limit");

            const reduction = Math.max(0.55, Math.min(0.85, Math.sqrt(targetBytes / result.size) * 0.95));
            edge = Math.max(minEdge, Math.floor(edge * reduction));
        }
    } finally {
        canvas.width = 0;
        canvas.height = 0;
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
        return { blob: await compressPhoto(image, photo), orientation };
    } catch {
        throw new PhotoPreparationError("Не удалось подготовить изображение. Попробуйте выбрать другой файл.");
    } finally {
        URL.revokeObjectURL(source);
    }
}
