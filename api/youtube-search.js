export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
  const requestedMaxResults = Number(req.body?.maxResults);
  const pageToken = typeof req.body?.pageToken === 'string' ? req.body.pageToken.trim() : '';
  const maxResults = Math.min(Math.max(Number.isFinite(requestedMaxResults) ? requestedMaxResults : 2, 1), 50);

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  if (!process.env.YOUTUBE_API_KEY) {
    return res.status(500).json({
      error: 'YouTube API not configured',
      message: 'Configure YOUTUBE_API_KEY nas variaveis de ambiente do Vercel'
    });
  }

  try {
    const { videos, nextPageToken } = await searchYoutubeVideos(query, maxResults, pageToken);

    return res.status(200).json({
      query,
      total: videos.length,
      videos,
      nextPageToken: nextPageToken || ''
    });
  } catch (error) {
    console.error('[youtube-search] request failed:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

async function searchYoutubeVideos(query, maxResults, pageToken = '') {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const recommendedMode = maxResults <= 2;
  const searchPoolSize = Math.min(
    Math.max(recommendedMode ? maxResults * 4 : maxResults, recommendedMode ? 8 : 12),
    50
  );
  const searchParams = new URLSearchParams({
    key: apiKey,
    part: 'snippet',
    type: 'video',
    maxResults: String(searchPoolSize),
    q: query,
    order: 'relevance',
    safeSearch: 'strict',
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    regionCode: 'BR',
    relevanceLanguage: 'pt',
    videoDuration: recommendedMode ? 'medium' : 'any'
  });

  if (pageToken) {
    searchParams.set('pageToken', pageToken);
  }

  const searchResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`);
  if (!searchResponse.ok) {
    const errorText = await searchResponse.text().catch(() => '');
    throw new Error(`YouTube search API error: ${searchResponse.status} ${errorText}`.trim());
  }

  const searchData = await searchResponse.json();
  const nextPageToken = typeof searchData?.nextPageToken === 'string' ? searchData.nextPageToken : '';
  const rawItems = Array.isArray(searchData.items) ? searchData.items : [];
  const filteredSearchItems = rawItems.filter((item) => {
    const videoId = item?.id?.videoId;
    const broadcast = item?.snippet?.liveBroadcastContent;
    return Boolean(videoId) && (!broadcast || broadcast === 'none');
  });

  if (filteredSearchItems.length === 0) {
    return {
      videos: [],
      nextPageToken
    };
  }

  const videoIds = filteredSearchItems
    .map((item) => item.id.videoId)
    .filter(Boolean)
    .slice(0, searchPoolSize);

  const detailsParams = new URLSearchParams({
    key: apiKey,
    part: 'contentDetails,statistics',
    id: videoIds.join(',')
  });

  const detailsResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailsParams.toString()}`);
  if (!detailsResponse.ok) {
    const errorText = await detailsResponse.text().catch(() => '');
    throw new Error(`YouTube videos API error: ${detailsResponse.status} ${errorText}`.trim());
  }

  const detailsData = await detailsResponse.json();
  const detailMap = new Map(
    (Array.isArray(detailsData.items) ? detailsData.items : []).map((item) => [item.id, item])
  );

  const videos = filteredSearchItems
    .map((item) => {
      const videoId = item.id.videoId;
      const details = detailMap.get(videoId);
      const durationSeconds = parseIsoDurationToSeconds(details?.contentDetails?.duration || '');

      return {
        videoId,
        title: cleanInline(item?.snippet?.title || ''),
        description: cleanInline(item?.snippet?.description || ''),
        channelTitle: cleanInline(item?.snippet?.channelTitle || ''),
        publishedAt: item?.snippet?.publishedAt || '',
        thumbnail:
          item?.snippet?.thumbnails?.high?.url ||
          item?.snippet?.thumbnails?.medium?.url ||
          item?.snippet?.thumbnails?.default?.url ||
          '',
        watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
        durationLabel: formatDuration(durationSeconds),
        durationSeconds,
        viewCount: Number(details?.statistics?.viewCount || 0),
        viewCountLabel: formatViewCount(details?.statistics?.viewCount || 0)
      };
    })
    .filter((video) => {
      if (!video.title || !video.embedUrl) {
        return false;
      }

      if (!recommendedMode) {
        return true;
      }

      return !video.durationSeconds || video.durationSeconds >= 90;
    })
    .slice(0, maxResults);

  return {
    videos,
    nextPageToken
  };
}

function parseIsoDurationToSeconds(value) {
  if (!value) return 0;
  const match = String(value).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function formatDuration(totalSeconds) {
  const seconds = Number(totalSeconds || 0);
  if (!seconds) return '';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatViewCount(value) {
  const count = Number(value || 0);
  if (!count) return '';
  return new Intl.NumberFormat('pt-BR', {
    notation: count >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(count) + ' visualizações';
}

function cleanInline(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
