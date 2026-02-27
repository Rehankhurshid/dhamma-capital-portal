import { NextRequest, NextResponse } from "next/server";
import { getConfig, getEnvFromProcess, extractFileUrl, patchCollectionItem } from "@/app/lib/api";

function formatBytes(bytes: number, decimals = 1) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export async function POST(req: NextRequest) {
    try {
        const env = getEnvFromProcess();
        const cfg = getConfig(env);

        const body: any = await req.json();

        // Webflow v2 payloads nest inside "payload", v1 sends flat
        const item = body.payload || body;

        const collectionId = item.collectionId || item._cid;
        const itemId = item.id || item._id;
        const fieldData = item.fieldData || item;

        if (!collectionId || !itemId) {
            return NextResponse.json({ message: "Invalid payload: missing IDs" }, { status: 400 });
        }

        // Ensure this is the documents collection
        if (collectionId !== cfg.documentsCollectionId) {
            return NextResponse.json({ message: "Ignored: not documents collection" }, { status: 200 });
        }

        const fileUrl = extractFileUrl(fieldData);
        if (!fileUrl) {
            return NextResponse.json({ message: "Ignored: no file attached" }, { status: 200 });
        }

        const currentSizeLabel = fieldData.file_size_label || fieldData['file-size-label'];

        // Fetch real file size
        const headRes = await fetch(fileUrl, { method: "HEAD" });
        const sizeRaw = headRes.headers.get("content-length");
        const sizeNum = parseInt(sizeRaw || "0", 10);

        if (sizeNum === 0) {
            return NextResponse.json({ message: "Could not determine file size" }, { status: 200 });
        }

        const sizeLabel = formatBytes(sizeNum);

        // Avoid infinite webhook loops
        if (currentSizeLabel === sizeLabel) {
            return NextResponse.json({ message: "Size already up to date" }, { status: 200 });
        }

        // Patch the Webflow CMS Item
        let fieldKey = 'file-size-label';
        if ('file_size_label' in fieldData) fieldKey = 'file_size_label';

        await patchCollectionItem(collectionId, itemId, { [fieldKey]: sizeLabel }, cfg);

        return NextResponse.json({
            success: true,
            message: `Updated item ${itemId} size to ${sizeLabel}`
        }, { status: 200 });

    } catch (err) {
        console.error("Webflow Webhook Error:", err);
        return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
    }
}
