import axios from "axios"
import { parseChatData, getOptionsFromLivePage } from "./parser"
import { FetchOptions } from "./types/yt-response"
import { ChatItem, YoutubeId } from "./types/data"

axios.defaults.headers.common["Accept-Encoding"] = "utf-8"

export async function fetchChat(options: FetchOptions): Promise<[ChatItem[], string]> {
  const url = `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${options.apiKey}`
  
  // Updated request payload with more complete context
  const payload = {
    context: {
      client: {
        clientVersion: options.clientVersion,
        clientName: "WEB",
        hl: "ja",
        gl: "JP",
        utcOffsetMinutes: new Date().getTimezoneOffset() * -1,
      },
      user: {
        lockedSafetyMode: false
      },
      request: {
        useSsl: true,
        internalExperimentFlags: [],
        consistencyTokenJars: []
      }
    },
    continuation: options.continuation,
  }
  
  // Add additional headers that YouTube might expect
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "X-YouTube-Client-Name": "1",
    "X-YouTube-Client-Version": options.clientVersion,
    "Origin": "https://www.youtube.com",
    "Referer": "https://www.youtube.com/",
  }
  
  const res = await axios.post(url, payload, { headers })

  return parseChatData(res.data)
}

export async function fetchLivePage(id: { channelId: string } | { liveId: string } | { handle: string }) {
  const url = generateLiveUrl(id)
  if (!url) {
    throw TypeError("not found id")
  }
  const res = await axios.get(url)
  return getOptionsFromLivePage(res.data.toString())
}

function generateLiveUrl(id: YoutubeId) {
  if ("channelId" in id) {
    return `https://www.youtube.com/channel/${id.channelId}/live`
  } else if ("liveId" in id) {
    return `https://www.youtube.com/watch?v=${id.liveId}`
  } else if ("handle" in id) {
    let handle = id.handle
    if (!handle.startsWith("@")) {
      handle = "@" + handle
    }
    return `https://www.youtube.com/${handle}/live`
  }
  return ""
}
