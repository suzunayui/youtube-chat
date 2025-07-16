"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseChatData = exports.getOptionsFromLivePage = void 0;
function getOptionsFromLivePage(data) {
    let liveId;
    const idResult = data.match(/<link rel="canonical" href="https:\/\/www.youtube.com\/watch\?v=(.+?)">/);
    if (idResult) {
        liveId = idResult[1];
    }
    else {
        throw new Error("Live Stream was not found");
    }
    const replayResult = data.match(/['"]isReplay['"]:\s*(true)/);
    if (replayResult) {
        throw new Error(`${liveId} is finished live`);
    }
    let apiKey;
    const keyResult = data.match(/['"]INNERTUBE_API_KEY['"]:\s*['"](.+?)['"]/);
    if (keyResult) {
        apiKey = keyResult[1];
    }
    else {
        throw new Error("API Key was not found");
    }
    let clientVersion;
    const verResult = data.match(/['"]clientVersion['"]:\s*['"]([\d.]+?)['"]/);
    if (verResult) {
        clientVersion = verResult[1];
    }
    else {
        throw new Error("Client Version was not found");
    }
    let continuation;
    const continuationResult = data.match(/['"]continuation['"]:\s*['"](.+?)['"]/);
    if (continuationResult) {
        continuation = continuationResult[1];
    }
    else {
        throw new Error("Continuation was not found");
    }
    return {
        liveId,
        apiKey,
        clientVersion,
        continuation,
    };
}
exports.getOptionsFromLivePage = getOptionsFromLivePage;
/** get_live_chat レスポンスを変換 */
function parseChatData(data) {
    let chatItems = [];
    if (data.continuationContents.liveChatContinuation.actions) {
        chatItems = data.continuationContents.liveChatContinuation.actions
            .map((v) => parseActionToChatItem(v))
            .filter((v) => v !== null);
    }
    const continuationData = data.continuationContents.liveChatContinuation.continuations[0];
    let continuation = "";
    if (continuationData.invalidationContinuationData) {
        continuation = continuationData.invalidationContinuationData.continuation;
    }
    else if (continuationData.timedContinuationData) {
        continuation = continuationData.timedContinuationData.continuation;
    }
    return [chatItems, continuation];
}
exports.parseChatData = parseChatData;
/** サムネイルオブジェクトをImageItemへ変換 */
function parseThumbnailToImageItem(data, alt) {
    // data が undefined または empty array の場合の処理
    if (!data || !Array.isArray(data) || data.length === 0) {
        return {
            url: "",
            alt: alt || "",
        };
    }
    const thumbnail = data.pop();
    if (thumbnail) {
        return {
            url: thumbnail.url || "",
            alt: alt || "",
        };
    }
    else {
        return {
            url: "",
            alt: alt || "",
        };
    }
}
function convertColorToHex6(colorNum) {
    return `#${colorNum.toString(16).slice(2).toLocaleUpperCase()}`;
}
/** メッセージrun配列をMessageItem配列へ変換 */
function parseMessages(runs) {
    // runs が undefined または null の場合は空配列を返す
    if (!runs || !Array.isArray(runs)) {
        return [];
    }
    return runs.map((run) => {
        if ("text" in run) {
            return run;
        }
        else {
            // Emoji
            const thumbnail = run.emoji.image.thumbnails.shift();
            const isCustomEmoji = Boolean(run.emoji.isCustomEmoji);
            const shortcut = run.emoji.shortcuts ? run.emoji.shortcuts[0] : "";
            return {
                url: thumbnail ? thumbnail.url : "",
                alt: shortcut,
                isCustomEmoji: isCustomEmoji,
                emojiText: isCustomEmoji ? shortcut : run.emoji.emojiId,
            };
        }
    });
}
/** actionの種類を判別してRendererを返す */
function rendererFromAction(action) {
    if (!action.addChatItemAction) {
        return null;
    }
    const item = action.addChatItemAction.item;
    if (item.liveChatTextMessageRenderer) {
        return item.liveChatTextMessageRenderer;
    }
    else if (item.liveChatPaidMessageRenderer) {
        return item.liveChatPaidMessageRenderer;
    }
    else if (item.liveChatPaidStickerRenderer) {
        return item.liveChatPaidStickerRenderer;
    }
    else if (item.liveChatMembershipItemRenderer) {
        return item.liveChatMembershipItemRenderer;
    }
    else if (item.liveChatMembershipGiftingRenderer) {
        return item.liveChatMembershipGiftingRenderer;
    }
    else if (item.liveChatMembershipGiftPurchaseAnnouncementRenderer) {
        return item.liveChatMembershipGiftPurchaseAnnouncementRenderer;
    }
    else if (item.liveChatMembershipGiftRedemptionAnnouncementRenderer) {
        return item.liveChatMembershipGiftRedemptionAnnouncementRenderer;
    }
    else if (item.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer) {
        return item.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer;
    }
    else if (item.liveChatSponsorshipsGiftRedemptionAnnouncementRenderer) {
        return item.liveChatSponsorshipsGiftRedemptionAnnouncementRenderer;
    }
    // 未知のチャットタイプの場合はログに出力（デバッグ用）
    if (process.env.NODE_ENV !== 'production') {
        console.log('Unknown chat item type:', Object.keys(item));
    }
    return null;
}
/** an action to a ChatItem */
function parseActionToChatItem(data) {
    var _a, _b, _c, _d, _e, _f;
    const messageRenderer = rendererFromAction(data);
    if (messageRenderer === null) {
        return null;
    }
    let message = [];
    if ("message" in messageRenderer && ((_a = messageRenderer.message) === null || _a === void 0 ? void 0 : _a.runs)) {
        message = messageRenderer.message.runs;
    }
    else if ("headerSubtext" in messageRenderer && ((_b = messageRenderer.headerSubtext) === null || _b === void 0 ? void 0 : _b.runs)) {
        message = messageRenderer.headerSubtext.runs;
    }
    const authorNameText = (_d = (_c = messageRenderer.authorName) === null || _c === void 0 ? void 0 : _c.simpleText) !== null && _d !== void 0 ? _d : "";
    const ret = {
        id: messageRenderer.id,
        author: {
            name: authorNameText,
            thumbnail: ((_e = messageRenderer.authorPhoto) === null || _e === void 0 ? void 0 : _e.thumbnails)
                ? parseThumbnailToImageItem(messageRenderer.authorPhoto.thumbnails, authorNameText)
                : { url: "", alt: "" },
            channelId: messageRenderer.authorExternalChannelId,
        },
        message: parseMessages(message),
        isMembership: false,
        isOwner: false,
        isVerified: false,
        isModerator: false,
        timestamp: new Date(Number(messageRenderer.timestampUsec) / 1000),
    };
    if (messageRenderer.authorBadges) {
        for (const entry of messageRenderer.authorBadges) {
            const badge = entry.liveChatAuthorBadgeRenderer;
            if (badge.customThumbnail) {
                ret.author.badge = {
                    thumbnail: parseThumbnailToImageItem(badge.customThumbnail.thumbnails, badge.tooltip),
                    label: badge.tooltip,
                };
                ret.isMembership = true;
            }
            else {
                switch ((_f = badge.icon) === null || _f === void 0 ? void 0 : _f.iconType) {
                    case "OWNER":
                        ret.isOwner = true;
                        break;
                    case "VERIFIED":
                        ret.isVerified = true;
                        break;
                    case "MODERATOR":
                        ret.isModerator = true;
                        break;
                }
            }
        }
    }
    if ("sticker" in messageRenderer) {
        ret.superchat = {
            amount: messageRenderer.purchaseAmountText.simpleText,
            color: convertColorToHex6(messageRenderer.backgroundColor),
            sticker: parseThumbnailToImageItem(messageRenderer.sticker.thumbnails, messageRenderer.sticker.accessibility.accessibilityData.label),
        };
    }
    else if ("purchaseAmountText" in messageRenderer) {
        ret.superchat = {
            amount: messageRenderer.purchaseAmountText.simpleText,
            color: convertColorToHex6(messageRenderer.bodyBackgroundColor),
        };
    }
    return ret;
}
//# sourceMappingURL=parser.js.map