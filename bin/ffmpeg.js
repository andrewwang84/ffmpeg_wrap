#!/usr/bin/env node

/**
 * FFmpeg Wrapper CLI Tool
 *
 * 用途：簡化 FFmpeg 常用操作的命令行工具
 * 使用方式：vid [fileName] [fileName]......
 *
 * npm i -g .
 * npm uninstall -g ffmpeg_wrap
 * npm ls -g --depth=0
 * npm update -g ffmpeg_wrap
 */

const readlineSync = require('readline-sync');
const fs = require('fs');
const { spawn } = require('child_process');

// ==================== 常數定義 ====================

const MODES = {
    ADD_WATERMARK: 0,
    CUT_BY_TIME: 1,
    CUT_BY_DURATION: 2,
    VIDEO_CONCAT: 3,
    VIDEO_TO_THUMBNAILS: 4,
    VIDEO_REENCODE: 5,
    REMOVE_AUDIO: 6,
    TELEGRAM_WEBM: 7,
    CUT_AND_TELEGRAM_WEBM: 8,
    LINE_APNG_TO_TELEGRAM_WEBM: 9
};

const MODE_NAMES = [
    'Add Watermark',
    'Cut Video by Time',
    'Cut Video by Duration',
    'Video Concat',
    'Video -> Thumbnails',
    'Video Re-encode',
    'Remove Audio',
    'Re-Encode to Telegram Webm',
    'Cut & Re-Encode to Telegram Webm',
    'Line APNG to Telegram Webm'
];

const RESOLUTIONS = [
    { name: '1280x720', watermarkPos: '978:692' },
    { name: '1920x1080', watermarkPos: '1618:1052' },
    { name: '1080x1920', watermarkPos: '778:1892' },
    { name: '3840x2160', watermarkPos: '3538:2132' },
    { name: '2160x3840', watermarkPos: '1858:3814' },
    { name: '4096x2160', watermarkPos: '3794:2132' },
    { name: 'Other', watermarkPos: '1' }
];

const WATERMARK_POSITIONS = {
    TOP_LEFT: 0,
    TOP_RIGHT: 1,
    BOTTOM_LEFT: 2,
    BOTTOM_RIGHT: 3
};

const WATERMARK_POSITION_NAMES = [
    'Top Left',
    'Top Right',
    'Bottom Left',
    'Bottom Right'
];

const SUPPORTED_EXTENSIONS = /mp4|ts|tp|mkv|flv|png|gif|webm/;
const WATERMARK_FILE = 'Logo-crop2.png';
const WATERMARK_WIDTH = 302;
const WATERMARK_HEIGHT = 28;
const TELEGRAM_WEBM_SCALE = "scale='if(eq(a,1),512,if(gt(a,1),512,-2))':'if(eq(a,1),512,if(gt(a,1),-2,512))'";

const VIDEO_CODECS = ['copy', 'libx264', 'libx265'];
const AUDIO_CODECS = ['copy', 'aac', 'libopus'];
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
 * @param {boolean} includeMilliseconds - 是否包含毫秒
 */
function askForTime(label, includeMilliseconds = true) {
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

    if (includeMilliseconds) {
        const ms = readlineSync.question('ms: ', {
            limit: /[0-9][0-9][0-9]/,
            limitMessage: 'Please input ms format time',
            defaultInput: '000'
        });
        return `${hh}:${mm}:${ss}.${ms}`;
    }

    return `${hh}:${mm}:${ss}`;
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
        limit: /^[1-3]?$/,
        limitMessage: 'Please input 1-3',
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
 * 計算浮水印位置
 */
function calculateWatermarkPosition(positionMode, width, height) {
    const offsetW = width - WATERMARK_WIDTH;
    const offsetH = height - WATERMARK_HEIGHT;

    switch (positionMode) {
        case WATERMARK_POSITIONS.TOP_LEFT:
            return '2:2';
        case WATERMARK_POSITIONS.TOP_RIGHT:
            return `${offsetW}:2`;
        case WATERMARK_POSITIONS.BOTTOM_LEFT:
            return `2:${offsetH}`;
        case WATERMARK_POSITIONS.BOTTOM_RIGHT:
        default:
            return `${offsetW}:${offsetH}`;
    }
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

    const proc = spawn('ffmpeg', args);

    proc.stdout.on('data', (data) => {
        console.log(`[stdout] ${data}`);
    });

    proc.stderr.setEncoding('utf8')
        .on('data', (data) => {
            console.log(`[stderr] ${data}`);
        })
        .on('message', (msg) => {
            console.log(`[message] ${msg}`);
        })
        .on('error', (err) => {
            console.error(`[error] ${err}`);
        })
        .on('exit', (code, signal) => {
            console.log(`[exit] code:${code} signal:${signal}`);
        })
        .on('close', () => {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`[close] ${fileName}.${extension} Done`);
            console.log('='.repeat(60));
        });
}

// ==================== 模式處理函數 ====================

/**
 * 模式 0: 添加浮水印
 */
function handleAddWatermark(fileName, extension) {
    const resolutionNames = RESOLUTIONS.map(r => r.name);
    const selectedResIndex = readlineSync.keyInSelect(resolutionNames, 'Resolution: ');

    if (selectedResIndex === -1) {
        throw '\nError: Program Stopped!!';
    }

    const selectedResolution = RESOLUTIONS[selectedResIndex];
    const markPosMode = readlineSync.keyInSelect(WATERMARK_POSITION_NAMES, 'Mode: ', { defaultInput: '4' });
    console.log(`\nMarkPosMode: [${markPosMode + 1}] ${WATERMARK_POSITION_NAMES[markPosMode]}\n`);

    let width, height, videoSize;

    // 自訂解析度
    if (selectedResolution.name === 'Other') {
        width = parseInt(readlineSync.question('Width: ', {
            limit: /[0-9]+/,
            limitMessage: 'Width',
            defaultInput: '1920'
        }));
        height = parseInt(readlineSync.question('Height: ', {
            limit: /[0-9]+/,
            limitMessage: 'Height',
            defaultInput: '1080'
        }));
        videoSize = `${width}x${height}`;
    } else {
        const [w, h] = selectedResolution.name.split('x');
        width = parseInt(w);
        height = parseInt(h);
        videoSize = selectedResolution.name;
    }

    const markPos = calculateWatermarkPosition(markPosMode, width, height);
    console.log(`${videoSize} => ${markPos}\n`);

    const videoEncode = askForVideoEncode();
    const audioEncode = askForAudioEncode();

    const outputFile = `${fileName}_watermark.${extension}`;
    const cmdPreview = `ffmpeg -i ${fileName}.${extension} -i ${WATERMARK_FILE} -filter_complex "overlay=${markPos}" ${videoEncode.str} ${audioEncode.str} ${outputFile}`;
    const args = [
        '-i', `${fileName}.${extension}`,
        '-i', WATERMARK_FILE,
        '-filter_complex', `overlay=${markPos}`,
        ...videoEncode.arr,
        ...audioEncode.arr,
        outputFile
    ];

    return { args, cmdPreview };
}

/**
 * 模式 1: 依時間點裁切影片
 */
function handleCutByTime(fileName, extension) {
    const start = askForTime('Start at');
    const end = askForTime('End at');

    console.log(`\nStart: ${start}`);
    console.log(`End: ${end}\n`);

    const videoEncode = askForVideoEncode();
    const audioEncode = askForAudioEncode();
    const { str: tsStr, arr: tsArr } = getTsMapArgs(extension);

    const outputFile = `${fileName}_${formatTimeForFilename(start)}_${formatTimeForFilename(end)}_cut.${extension}`;

    let args1, cmdPreview;

    // 重新編碼時，-ss 放在 -i 後面較精確
    // 不重新編碼時，-ss 放在 -i 前面較快速
    if (videoEncode.codec !== 'copy' || audioEncode.codec !== 'copy') {
        cmdPreview = `ffmpeg -i ${fileName}.${extension} -ss ${start} -to ${end} ${videoEncode.str} ${audioEncode.str} ${tsStr} ${outputFile}`;
        args1 = ['-i', `${fileName}.${extension}`, '-ss', start, '-to', end];
    } else {
        cmdPreview = `ffmpeg -ss ${start} -to ${end} -i ${fileName}.${extension} ${videoEncode.str} ${audioEncode.str} ${tsStr} ${outputFile}`;
        args1 = ['-ss', start, '-to', end, '-i', `${fileName}.${extension}`];
    }

    const args = [...args1, ...videoEncode.arr, ...audioEncode.arr, ...tsArr, outputFile];

    return { args, cmdPreview };
}

/**
 * 模式 2: 依持續時間裁切影片
 */
function handleCutByDuration(fileName, extension) {
    const start = askForTime('Start at');
    const duration = askForTime('Duration');

    console.log(`\nStart: ${start}`);
    console.log(`Duration: ${duration}\n`);

    const videoEncode = askForVideoEncode();
    const audioEncode = askForAudioEncode();
    const { str: tsStr, arr: tsArr } = getTsMapArgs(extension);

    const outputFile = `${fileName}_${formatTimeForFilename(start)}_${formatTimeForFilename(duration)}_duration_cut.${extension}`;

    let args1, cmdPreview;

    if (videoEncode.codec !== 'copy' || audioEncode.codec !== 'copy') {
        cmdPreview = `ffmpeg -i ${fileName}.${extension} -ss ${start} -t ${duration} ${videoEncode.str} ${audioEncode.str} ${tsStr} ${outputFile}`;
        args1 = ['-i', `${fileName}.${extension}`, '-ss', start, '-t', duration];
    } else {
        cmdPreview = `ffmpeg -ss ${start} -t ${duration} -i ${fileName}.${extension} ${videoEncode.str} ${audioEncode.str} ${tsStr} ${outputFile}`;
        args1 = ['-ss', start, '-t', duration, '-i', `${fileName}.${extension}`];
    }

    const args = [...args1, ...videoEncode.arr, ...audioEncode.arr, ...tsArr, outputFile];

    return { args, cmdPreview };
}

/**
 * 模式 3: 影片合併
 */
function handleVideoConcat(extension) {
    const files = process.argv.slice(2);
    let fileListContent = '';

    for (const file of files) {
        fileListContent += `file '${file}'\n`;
    }

    fs.writeFileSync('file.txt', fileListContent, 'utf8');
    console.log('file.txt created with:', fileListContent);

    const { fileName } = parseFilePath(files[0]);
    const outputFile = `${fileName}_concat.${extension}`;
    const cmdPreview = `ffmpeg -f concat -safe 0 -i file.txt -c copy ${outputFile}`;
    const args = [
        '-f', 'concat',
        '-safe', '0',
        '-i', 'file.txt',
        '-c', 'copy',
        outputFile
    ];

    return { args, cmdPreview };
}

/**
 * 模式 4: 影片轉縮圖
 */
function handleVideoToThumbnails(file) {
    const start = askForTime('Start at', false);
    const end = askForTime('End at', false);

    console.log(`\nStart: ${start}`);
    console.log(`End: ${end}\n`);

    const cmdPreview = `ffmpeg -ss ${start} -t ${end} -i ${file} thumb%04d.png -hide_banner`;
    const args = [
        '-ss', start,
        '-t', end,
        '-i', file,
        'thumb%04d.png',
        '-hide_banner'
    ];

    return { args, cmdPreview };
}

/**
 * 模式 5: 影片重新編碼
 */
function handleVideoReencode(fileName, extension) {
    const videoEncode = askForVideoEncode();
    const audioEncode = askForAudioEncode();

    const outputExtension = readlineSync.question(`副檔名 (Current: ${extension}): `, {
        limitMessage: '副檔名',
        defaultInput: extension
    });

    const { arr: tsArr } = getTsMapArgs(extension);

    const outputFile = `${fileName}_re.${outputExtension}`;
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
 * 模式 6: 移除音軌
 */
function handleRemoveAudio(fileName, extension) {
    const outputFile = `${fileName}_mute.${extension}`;
    const cmdPreview = `ffmpeg -i ${fileName}.${extension} -c:v copy -an ${outputFile}`;
    const args = [
        '-i', `${fileName}.${extension}`,
        '-c:v', 'copy',
        '-an',
        outputFile
    ];

    return { args, cmdPreview };
}

/**
 * 模式 7: 轉換為 Telegram WebM 格式
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
 * 模式 8: 裁切並轉換為 Telegram WebM 格式
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
 * 模式 9: Line APNG 轉 Telegram WebM
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

// ==================== 主程式 ====================

function main() {
    const file = process.argv[2];

    if (!file) {
        throw 'Usage: vid [fileName] [fileName]......';
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
        case MODES.ADD_WATERMARK:
            result = handleAddWatermark(fileName, extension);
            break;

        case MODES.CUT_BY_TIME:
            result = handleCutByTime(fileName, extension);
            break;

        case MODES.CUT_BY_DURATION:
            result = handleCutByDuration(fileName, extension);
            break;

        case MODES.VIDEO_CONCAT:
            result = handleVideoConcat(extension);
            break;

        case MODES.VIDEO_TO_THUMBNAILS:
            result = handleVideoToThumbnails(file);
            break;

        case MODES.VIDEO_REENCODE:
            result = handleVideoReencode(fileName, extension);
            break;

        case MODES.REMOVE_AUDIO:
            result = handleRemoveAudio(fileName, extension);
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
