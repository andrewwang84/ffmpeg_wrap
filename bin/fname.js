#!/usr/bin/env node

/**
 * fname — P2P Release Naming Convention Formatter
 *
 * 用途：解析錄影檔名，透過 mediainfo 取得影片規格，
 *       印出符合 P2P Release Naming Convention 的檔名（不改名）
 *
 * 使用方式：fname [fileName] [fileName]...
 *
 * 輸入格式：YYYYMMDD[HHSS]_station_recorder_title.ext
 * 輸出格式：YYMMDD_station_recorder_title resolution.VideoCodec.AudioCodec.ext
 */

const path = require('path');
const { spawnSync } = require('child_process');

// ==================== Codec / Resolution 對應表 ====================

const VIDEO_CODEC_MAP = {
    'MPEG Video': 'MPEG2',
    'AVC':        'H264',
    'HEVC':       'H265',
    'VP9':        'VP9',
    'AV1':        'AV1',
    'VC-1':       'VC1',
};

const AUDIO_CODEC_MAP = {
    'AAC':         'AAC',
    'AC-3':        'AC3',
    'E-AC-3':      'EAC3',
    'DTS':         'DTS',
    'MPEG Audio':  'MP3',
    'Opus':        'Opus',
    'FLAC':        'FLAC',
    'PCM':         'PCM',
};

// ==================== 工具函數 ====================

function mapVideoCodec(format) {
    if (!format) return null;
    for (const [key, val] of Object.entries(VIDEO_CODEC_MAP)) {
        if (format.includes(key)) return val;
    }
    return format.trim();
}

function mapAudioCodec(format) {
    if (!format) return null;
    for (const [key, val] of Object.entries(AUDIO_CODEC_MAP)) {
        if (format.includes(key)) return val;
    }
    return format.trim();
}

function parseResolution(videoTrack) {
    const height = videoTrack['Height'];
    const scanType = videoTrack['ScanType'] || '';
    if (!height) return null;
    const suffix = scanType.toLowerCase().includes('interlace') ? 'i' : 'p';
    return `${height}${suffix}`;
}

function getMediaInfo(filePath) {
    const result = spawnSync('mediainfo', ['--Output=JSON', filePath], {
        encoding: 'utf8',
        windowsHide: true,
    });

    if (result.error) {
        throw new Error(`mediainfo 執行失敗：${result.error.message}`);
    }
    if (result.status !== 0) {
        throw new Error(`mediainfo 回傳非零狀態碼 ${result.status}`);
    }

    let parsed;
    try {
        parsed = JSON.parse(result.stdout);
    } catch {
        throw new Error('mediainfo 輸出無法解析為 JSON');
    }

    const tracks = (parsed.media && parsed.media.track) ? parsed.media.track : [];
    const videoTrack = tracks.find(t => t['@type'] === 'Video') || {};
    const audioTrack = tracks.find(t => t['@type'] === 'Audio') || {};

    return { videoTrack, audioTrack };
}

function formatFileName(filePath) {
    const basename = path.basename(filePath);
    const ext = path.extname(basename);
    const nameWithoutExt = basename.slice(0, basename.length - ext.length);

    // 嘗試拆解：YYYYMMDD[HHSS]_station_recorder_title
    const match = nameWithoutExt.match(/^(\d{8,12})_([^_]+)_([^_]+)_([\s\S]+)$/);

    let prefix;
    if (match) {
        const [, dateFull, station, recorder, title] = match;
        // YYYYMMDD... → 取第 3~8 個字元（index 2..8），得 YYMMDD
        const date = dateFull.slice(2, 8);
        prefix = `${date}_${station}_${recorder}_${title}`;
    } else {
        // 無日期前綴，直接使用原始檔名（不含副檔名）
        prefix = nameWithoutExt;
    }

    // 取得 mediainfo 資訊
    const { videoTrack, audioTrack } = getMediaInfo(filePath);

    const resolution = parseResolution(videoTrack);
    const videoCodec = mapVideoCodec(videoTrack['Format']);
    const audioCodec = mapAudioCodec(audioTrack['Format']);

    // 組合規格標籤（只有取得到的才加入）
    const specs = [resolution, videoCodec, audioCodec].filter(Boolean).join('.');

    const newName = specs
        ? `${prefix} ${specs}${ext}`
        : `${prefix}${ext}`;

    return newName;
}

// ==================== 主程式 ====================

const files = process.argv.slice(2);

if (files.length === 0) {
    console.error('用法：fname [檔名] [檔名]...');
    console.error('範例：fname "202604300500_ytv_rec1_タイトル.ts"');
    process.exit(1);
}

for (const file of files) {
    try {
        const result = formatFileName(file);
        console.log(result);
    } catch (err) {
        console.error(`[錯誤] ${path.basename(file)}: ${err.message}`);
    }
}
