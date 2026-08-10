#!/usr/bin/env node

/**
 * FFmpeg Wrapper CLI Tool
 *
 * 用途：簡化 FFmpeg 常用操作的命令行工具
 * 使用方式：vid [fileName]
 *
 * npm i -g .
 * npm uninstall -g ffmpeg_wrap
 * npm ls -g --depth=0
 * npm update -g ffmpeg_wrap
 */

const readlineSync = require('readline-sync');
const { spawn } = require('child_process');

// ==================== 常數定義 ====================

const MODES = {
    VIDEO_REENCODE: 0,
    TELEGRAM_WEBM: 1,
    CUT_AND_TELEGRAM_WEBM: 2,
    LINE_APNG_TO_TELEGRAM_WEBM: 3,
    TELEGRAM_GIF: 4
};

const MODE_NAMES = [
    'Video Re-encode',
    'Re-Encode to Telegram Webm',
    'Cut & Re-Encode to Telegram Webm',
    'Line APNG to Telegram Webm',
    'Re-Encode to Telegram Gif'
];

const SUPPORTED_EXTENSIONS = /mp4|ts|tp|mkv|flv|png|gif|webm/;
const TELEGRAM_WEBM_SCALE = "scale='if(eq(a,1),512,if(gt(a,1),512,-2))':'if(eq(a,1),512,if(gt(a,1),-2,512))'";
// Telegram Gif：維持比例，寬度最大 1080（不放大），長寬皆對齊偶數
const TELEGRAM_GIF_MAX_WIDTH = 1080;
const TELEGRAM_GIF_SCALE = `scale='min(${TELEGRAM_GIF_MAX_WIDTH},trunc(iw/2)*2)':-2`;

const VIDEO_CODECS = ['copy', 'libx264', 'libx265'];
const AUDIO_CODECS = ['copy', 'aac', 'libopus', 'none'];
const PRESETS = ['ultrafast', 'veryfast', 'faster', 'medium', 'slower', 'veryslow'];
const AUDIO_BITRATES = ['96k', '128k', '192k', '320k'];

// ==================== 工具函數 ====================

/**
 * 解析檔案路徑，取得檔名和副檔名
 */
function parseFilePath(filePath) {
    const lastDotIndex = filePath.lastIndexOf('.');
    return {
        fileName: filePath.slice(0, lastDotIndex),
        extension: filePath.slice(lastDotIndex + 1)
    };
}

/**
 * 詢問時間輸入 (hh:mm:ss.ms)
 * @param {string} label - 提示文字
 */
function askForTime(label) {
    const hh = readlineSync.question(`${label} hh: `, {
        limit: /[0-9]{2}/,
        limitMessage: 'Please input hh format time',
        defaultInput: '00'
    });
    const mm = readlineSync.question('mm: ', {
        limit: /[0-5][0-9]/,
        limitMessage: 'Please input mm format time',
        defaultInput: '00'
    });
    const ss = readlineSync.question('ss: ', {
        limit: /[0-5][0-9]/,
        limitMessage: 'Please input ss format time',
        defaultInput: '00'
    });

    const ms = readlineSync.question('ms: ', {
        limit: /[0-9][0-9][0-9]/,
        limitMessage: 'Please input ms format time',
        defaultInput: '000'
    });

    return `${hh}:${mm}:${ss}.${ms}`;
}

/**
 * 詢問短時間輸入 (適用於 Telegram 限制 3 秒)
 */
function askForShortDuration() {
    const ss = readlineSync.question('Duration for ss: ', {
        limit: /[0][0-2]/,
        limitMessage: 'Please input ss format time, max 02',
        defaultInput: '01'
    });
    const ms = readlineSync.question('ms: ', {
        limit: /[0-9][0-9][0-9]/,
        limitMessage: 'Please input ms format time',
        defaultInput: '990'
    });
    return `00:00:${ss}.${ms}`;
}

/**
 * 詢問視訊編碼設定
 * @returns {object} 包含編碼字串和參數陣列
 */
function askForVideoEncode() {
    console.log('\nVideo Codec:');
    VIDEO_CODECS.forEach((codec, index) => {
        console.log(`  [${index + 1}] ${codec}`);
    });

    const codecAnswer = readlineSync.question('Select [1]: ', {
        limit: /^[1-3]?$/,
        limitMessage: 'Please input 1-3',
        defaultInput: '1'
    });

    const codecIndex = codecAnswer === '' ? 0 : parseInt(codecAnswer) - 1;
    const codec = VIDEO_CODECS[codecIndex];
    console.log(`Video Codec: [${codecIndex + 1}] ${codec}\n`);

    if (codec === 'copy') {
        return {
            str: '-c:v copy',
            arr: ['-c:v', 'copy'],
            codec: 'copy'
        };
    }

    // 詢問 CRF
    const crf = readlineSync.question('CRF (0-51) [18]: ', {
        limit: /^([0-9]|[1-4][0-9]|5[0-1])$/,
        limitMessage: 'Please input 0-51',
        defaultInput: '18'
    });

    // 詢問 Preset
    console.log('\nPreset:');
    PRESETS.forEach((preset, index) => {
        console.log(`  [${index + 1}] ${preset}`);
    });

    const presetAnswer = readlineSync.question('Select [4]: ', {
        limit: /^[1-6]?$/,
        limitMessage: 'Please input 1-6',
        defaultInput: '4'
    });

    const presetIndex = presetAnswer === '' ? 3 : parseInt(presetAnswer) - 1;
    const preset = PRESETS[presetIndex];
    console.log(`Preset: [${presetIndex + 1}] ${preset}\n`);

    const baseArr = ['-c:v', codec, '-crf', crf, '-preset', preset];
    let baseStr = `-c:v ${codec} -crf ${crf} -preset ${preset}`;

    // H.265 需要額外加上 -tag:v hvc1
    if (codec === 'libx265') {
        baseArr.push('-tag:v', 'hvc1');
        baseStr += ' -tag:v hvc1';
    }

    return {
        str: baseStr,
        arr: baseArr,
        codec: codec
    };
}

/**
 * 詢問音訊編碼設定
 * @returns {object} 包含編碼字串和參數陣列
 */
function askForAudioEncode() {
    console.log('\nAudio Codec:');
    AUDIO_CODECS.forEach((codec, index) => {
        console.log(`  [${index + 1}] ${codec}`);
    });

    const codecAnswer = readlineSync.question('Select [1]: ', {
        limit: /^[1-4]?$/,
        limitMessage: 'Please input 1-4',
        defaultInput: '1'
    });

    const codecIndex = codecAnswer === '' ? 0 : parseInt(codecAnswer) - 1;
    const codec = AUDIO_CODECS[codecIndex];
    console.log(`Audio Codec: [${codecIndex + 1}] ${codec}\n`);

    if (codec === 'copy') {
        return {
            str: '-c:a copy',
            arr: ['-c:a', 'copy'],
            codec: 'copy'
        };
    }

    if (codec === 'none') {
        return {
            str: '-an',
            arr: ['-an'],
            codec: 'none'
        };
    }

    // 詢問 Bitrate
    console.log('Audio Bitrate:');
    AUDIO_BITRATES.forEach((bitrate, index) => {
        console.log(`  [${index + 1}] ${bitrate}`);
    });

    const bitrateAnswer = readlineSync.question('Select [3]: ', {
        limit: /^[1-4]?$/,
        limitMessage: 'Please input 1-4',
        defaultInput: '3'
    });

    const bitrateIndex = bitrateAnswer === '' ? 2 : parseInt(bitrateAnswer) - 1;
    const bitrate = AUDIO_BITRATES[bitrateIndex];
    console.log(`Audio Bitrate: [${bitrateIndex + 1}] ${bitrate}\n`);

    return {
        str: `-c:a ${codec} -b:a ${bitrate}`,
        arr: ['-c:a', codec, '-b:a', bitrate],
        codec: codec
    };
}

/**
 * 取得 TS 檔案的 map 參數
 */
function getTsMapArgs(extension) {
    if (/ts/.test(extension)) {
        return { str: '-map 0:v -map 0:a', arr: ['-map', '0:v', '-map', '0:a'] };
    }
    return { str: '', arr: [] };
}

/**
 * 格式化時間字串為檔案名稱（移除特殊字元）
 */
function formatTimeForFilename(timeStr) {
    return timeStr.replace(/[:\.]/g, '');
}

/**
 * 執行 FFmpeg 指令
 */
function executeFFmpeg(args, previewCommand, fileName, extension) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Execute Command:\n${previewCommand}`);
    console.log('='.repeat(60) + '\n');

    // stdio: 'inherit' 讓 ffmpeg 直接接上目前的終端機
    // 這樣 ffmpeg 的互動提示（例如 File exists. Overwrite? [y/N]）才能輸入，
    // 否則 stdin 是沒人寫入的 pipe，程式會一直卡住
    const proc = spawn('ffmpeg', args, { stdio: 'inherit' });

    proc.on('error', (err) => {
        console.error(`[error] ${err}`);
    });

    proc.on('close', (code, signal) => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`[exit] code:${code} signal:${signal}`);
        console.log(`[close] ${fileName}.${extension} Done`);
        console.log('='.repeat(60));
        if (code) {
            process.exitCode = code;
        }
    });
}

// ==================== 模式處理函數 ====================

/**
 * 模式 1: 影片重新編碼
 */
function handleVideoReencode(fileName, extension) {
    const videoEncode = askForVideoEncode();
    const audioEncode = askForAudioEncode();

    const outputExtension = readlineSync.question(`File Extension (Current: ${extension}): `, {
        limitMessage: 'File Extension',
        defaultInput: extension
    });

    const { arr: tsArr } = getTsMapArgs(extension);

    const suffix = audioEncode.codec === 'none' ? '_mute' : '_re';
    const outputFile = `${fileName}${suffix}.${outputExtension}`;
    const cmdPreview = `ffmpeg -i ${fileName}.${extension} ${videoEncode.str} ${audioEncode.str} ${tsArr.join(' ')} ${outputFile}`;
    const args = [
        '-i', `${fileName}.${extension}`,
        ...videoEncode.arr,
        ...audioEncode.arr,
        ...tsArr,
        outputFile
    ];

    return { args, cmdPreview };
}

/**
 * 模式 2: 轉換為 Telegram WebM 格式
 */
function handleTelegramWebm(fileName, extension) {
    const outputFile = `${fileName}_tg.webm`;
    const cmdPreview = `ffmpeg -i ${fileName}.${extension} -vf "${TELEGRAM_WEBM_SCALE}" -c:v libvpx-vp9 -an -crf 24 -b:v 0 -r 30 ${outputFile}`;
    const args = [
        '-i', `${fileName}.${extension}`,
        '-vf', TELEGRAM_WEBM_SCALE,
        '-c:v', 'libvpx-vp9',
        '-an',
        '-crf', '24',
        '-b:v', '0',
        '-r', '30',
        outputFile
    ];

    return { args, cmdPreview };
}

/**
 * 模式 3: 裁切並轉換為 Telegram WebM 格式
 */
function handleCutAndTelegramWebm(fileName, extension) {
    const start = askForTime('Start at');
    const duration = askForShortDuration();

    console.log(`\nStart: ${start}`);
    console.log(`Duration: ${duration}\n`);

    const crf = readlineSync.question('crf [24]: ', {
        limit: /[0-9]{1,2}/,
        limitMessage: 'Please input 0~60',
        defaultInput: '24'
    });

    const { arr: tsArr } = getTsMapArgs(extension);

    const outputFile = `${fileName}_${formatTimeForFilename(start)}_${formatTimeForFilename(duration)}_cut_tg.webm`;
    const cmdPreview = `ffmpeg -i ${fileName}.${extension} -ss ${start} -t ${duration} -vf "${TELEGRAM_WEBM_SCALE}" -c:v libvpx-vp9 -an -crf ${crf} -b:v 0 -r 30 ${outputFile}`;
    const args = [
        '-i', `${fileName}.${extension}`,
        '-ss', start,
        '-t', duration,
        '-vf', TELEGRAM_WEBM_SCALE,
        '-c:v', 'libvpx-vp9',
        '-an',
        '-crf', crf,
        '-b:v', '0',
        '-r', '30',
        ...tsArr,
        outputFile
    ];

    return { args, cmdPreview };
}

/**
 * 模式 4: Line APNG 轉 Telegram WebM
 */
function handleLineApngToTelegramWebm(fileName, extension) {
    const outputFile = `${fileName}_line_tg.webm`;
    const cmdPreview = `ffmpeg -i ${fileName}.${extension} -vf "fps=30,${TELEGRAM_WEBM_SCALE}" -c:v libvpx-vp9 -an -movflags +faststart -pix_fmt yuva420p ${outputFile}`;
    const args = [
        '-i', `${fileName}.${extension}`,
        '-vf', `fps=30,${TELEGRAM_WEBM_SCALE}`,
        '-c:v', 'libvpx-vp9',
        '-an',
        '-movflags', '+faststart',
        '-pix_fmt', 'yuva420p',
        outputFile
    ];

    return { args, cmdPreview };
}

/**
 * 模式 5: 轉換為 Telegram Gif（實際上是無音訊的 mp4）
 * 固定使用 H.265 / preset faster，移除音訊，維持比例且寬度最大 1080
 */
function handleTelegramGif(fileName, extension) {
    const crf = readlineSync.question('CRF (0-51) [23]: ', {
        limit: /^([0-9]|[1-4][0-9]|5[0-1])$/,
        limitMessage: 'Please input 0-51',
        defaultInput: '23'
    });
    console.log(`\nCRF: ${crf}`);
    console.log('Codec: libx265 / Preset: faster / Audio: none');
    console.log(`Max Width: ${TELEGRAM_GIF_MAX_WIDTH}\n`);

    const outputFile = `${fileName}_tg_gif.mp4`;
    const cmdPreview = `ffmpeg -i ${fileName}.${extension} -vf "${TELEGRAM_GIF_SCALE}" -c:v libx265 -tag:v hvc1 -crf ${crf} -preset faster -pix_fmt yuv420p -an -movflags +faststart ${outputFile}`;
    const args = [
        '-i', `${fileName}.${extension}`,
        '-vf', TELEGRAM_GIF_SCALE,
        '-c:v', 'libx265',
        '-tag:v', 'hvc1',
        '-crf', crf,
        '-preset', 'faster',
        '-pix_fmt', 'yuv420p',
        '-an',
        '-movflags', '+faststart',
        outputFile
    ];

    return { args, cmdPreview };
}

// ==================== 主程式 ====================

function main() {
    const file = process.argv[2];

    if (!file) {
        throw 'Usage: vid [fileName]';
    }

    const mode = readlineSync.keyInSelect(MODE_NAMES, 'Select Mode');

    if (mode === -1) {
        throw '\nAction Cancelled!!';
    }

    console.log(`\nMode: [${mode + 1}] ${MODE_NAMES[mode]}`);
    console.log(`File: ${file}\n`);

    const { fileName, extension } = parseFilePath(file);

    if (!SUPPORTED_EXTENSIONS.test(extension)) {
        throw '\nError: Not a supported video/image file!!';
    }

    let result;

    switch (mode) {
        case MODES.VIDEO_REENCODE:
            result = handleVideoReencode(fileName, extension);
            break;

        case MODES.TELEGRAM_WEBM:
            result = handleTelegramWebm(fileName, extension);
            break;

        case MODES.CUT_AND_TELEGRAM_WEBM:
            result = handleCutAndTelegramWebm(fileName, extension);
            break;

        case MODES.LINE_APNG_TO_TELEGRAM_WEBM:
            result = handleLineApngToTelegramWebm(fileName, extension);
            break;

        case MODES.TELEGRAM_GIF:
            result = handleTelegramGif(fileName, extension);
            break;

        default:
            throw '\nCommand Not Found!!';
    }

    executeFFmpeg(result.args, result.cmdPreview, fileName, extension);
}

// ==================== 程式進入點 ====================

try {
    main();
} catch (error) {
    console.error(`\n❌ Error: ${error}\n`);
    process.exit(1);
}
