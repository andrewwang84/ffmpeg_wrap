#!/usr/bin/env node

// npm i -g .
// npm uninstall -g ffmpeg_wrap
// npm ls -g --depth=0
// npm update -g ffmpeg_wrap
const readlineSync = require('readline-sync');
const fs = require('fs');
const spawn = require('child_process').spawn;

var mode = '';
var file = process.argv[2];

let modes = [
    'Add Watermark',
    'Cut Video by Time',
    'Cut Video by Duration',
    'M3U8 Merge(test.m3u8)',
    'Video Concat',
    'Video -> Thumbnails',
    'Video Size and Bitrate Reduce',
    'Remove Audio',
    'Re-Encode to Telegram Webm',
    'Cut & Re-Encode to Telegram Webm',
];

let res = [
    '1280x720',
    '1920x1080',
    '1080x1920',
    '3840x2160',
    '2160x3840',
    '4096x2160',
    'Other'
];

let resXY = [
    '978:692',
    '1618:1052',
    '778:1892',
    '3538:2132',
    '1858:3814',
    '3794:2132',
    '1'
];

let markPosModes = [
    'Top Left',
    'Top Right',
    'Bottom Left',
    'Bottom Right'
];

try {
    if (file == undefined) {
        throw (`Usage: vid [fileName] [fileName]......`);
    }

    mode = readlineSync.keyInSelect(modes, 'Enter Mode: ');
    if (mode == '-1') {
        throw ('\nAction Cancelled!!');
    }
    console.log(`\nMode: [${mode + 1}] ${modes[mode]}\n`);
    if (mode >= 0) {
        console.log(`File: ${file}`);
    }

    let ext = file.slice(file.lastIndexOf('.') + 1);
    let fileName = file.slice(0, file.lastIndexOf('.'));

    if (!(/mp4|ts|tp|mkv|flv/.test(ext))) {
        throw ('\nError: Not Video!!');
    }

    let cmd = 'ffmpeg';
    let cmdPreview = '';
    let start = '';
    let end = '';
    let duration = '';
    let args = [];
    let tsStr = '';
    let tsArr = [];
    let args1 = [];
    let args2 = [];
    let startH, startM, startS, startMS;
    let durationH, durationM, durationS, durationMS;
    let crf;
    switch (mode) {
        // 加浮水印
        case 0:
            let vidRes = readlineSync.keyInSelect(res, 'Resolution: ');

            if (res[vidRes] == undefined || resXY[vidRes] == undefined) {
                throw ('\nError: Program Stopped!!');
            }

            let markPosMode = readlineSync.keyInSelect(markPosModes, 'Mode: ', { defaultInput: '4' });
            console.log(`\nMarkPosMode: [${markPosMode + 1}] ${markPosModes[markPosMode]}\n`);

            let vidSize = res[vidRes];
            let markPos = resXY[vidRes];

            let w = 1;
            let h = 1;
            if (markPos == 1) {
                w = readlineSync.question('Width: ', {
                    limit: /[0-9]+/,
                    limitMessage: 'Width',
                    defaultInput: '1920'
                });
                h = readlineSync.question('Height: ', {
                    limit: /[0-9]+/,
                    limitMessage: 'Height',
                    defaultInput: '1080'
                });
                vidSize = `${w}x${h}`;
                markPos = `${w - 302}:${h - 28}`;
            } else {
                let sizes = vidSize.split('x');
                w = sizes[0];
                h = sizes[1];
            }

            switch (markPosMode) {
                // 右上
                case 1:
                    let offsetW = w - 302;
                    markPos = `${offsetW}:2`;
                    break;
                // 左下
                case 2:
                    let offsetH = h - 28;
                    markPos = `2:${offsetH}`;
                    break;
                // 右下
                case 3:
                    break;
                // 左上
                case 0:
                default:
                    markPos = "2:2";
                    break;
            }

            console.log(`${vidSize} => ${markPos}`);

            cmdPreview = `ffmpeg -i ${fileName}.${ext} -i Logo-crop2.png -filter_complex "overlay=${markPos}" -crf 18 -preset slow ${fileName}_watermark.${ext}`;
            args = [
                '-i', `${fileName}.${ext}`,
                '-i', `Logo-crop2.png`,
                '-filter_complex', `overlay=${markPos}`,
                '-crf', `18`,
                '-preset', `slow`,
                `${fileName}_watermark.${ext}`
            ];
            break;
        // 影片裁切
        case 1:
            startH = readlineSync.question('Start at hh: ', {
                limit: /[0-9]{2}/,
                limitMessage: 'Please input hh format time',
                defaultInput: '00'
            });
            startM = readlineSync.question('mm: ', {
                limit: /[0-5][0-9]/,
                limitMessage: 'Please input mm format time',
                defaultInput: '00'
            });
            startS = readlineSync.question('ss: ', {
                limit: /[0-5][0-9]/,
                limitMessage: 'Please input ss format time',
                defaultInput: '00'
            });
            startMS = readlineSync.question('ms: ', {
                limit: /[0-9][0-9][0-9]/,
                limitMessage: 'Please input ms format time',
                defaultInput: '000'
            });
            start = `${startH}:${startM}:${startS}.${startMS}`;

            let endH = readlineSync.question('End at hh: ', {
                limit: /[0-9]{2}/,
                limitMessage: 'Please input hh format time',
                defaultInput: '00'
            });
            let endM = readlineSync.question('mm: ', {
                limit: /[0-5][0-9]/,
                limitMessage: 'Please input mm format time',
                defaultInput: '00'
            });
            let endS = readlineSync.question('ss: ', {
                limit: /[0-5][0-9]/,
                limitMessage: 'Please input ss format time',
                defaultInput: '00'
            });
            let endMS = readlineSync.question('ms: ', {
                limit: /[0-9][0-9][0-9]/,
                limitMessage: 'Please input ms format time',
                defaultInput: '000'
            });
            end = `${endH}:${endM}:${endS}.${endMS}`;

            console.log(`\nStart: ${start}`);
            console.log(`End: ${end}\n`);

            doReEncode = readlineSync.question('Re-Encode with H.265? [y|N]: ', {
                limit: /y|N/,
                limitMessage: 'Please input [y|N]',
                defaultInput: 'N'
            });

            vidEncodeStr = /y/.test(doReEncode) ? '-c:v libx265' : '-c copy';
            vidEncodeArr = /y/.test(doReEncode) ? ['-c:v', 'libx265'] : ['-c:v', 'copy'];

            lettsStr = /ts/.test(ext) ? '-map 0:v -map 0:a' : '';
            tsArr = /ts/.test(ext) ? ['-map', '0:v', '-map', '0:a'] : [];

            tsStr = /ts/.test(ext) ? '-map 0:v -map 0:a' : '';
            tsArr = /ts/.test(ext) ? ['-map', '0:v', '-map', '0:a'] : [];

            cmdPreview = `ffmpeg -i ${fileName}.${ext} -ss ${start} -to ${end} ${vidEncodeStr} ${tsStr} ${fileName}_cut.${ext}`;
            args1 = [
                '-i', `${fileName}.${ext}`,
                '-ss', start,
                '-to', end,
            ];
            args2 = [
                `${fileName}_${start.replace(/:|\./g, '')}_${end.replace(/:|\./g, '')}_cut.${ext}`
            ];

            args = [...args1, ...vidEncodeArr, ...tsArr, ...args2];
            break;
        // 影片以固定時間分割(單段)
        case 2:
            startH = readlineSync.question('Start at hh: ', {
                limit: /[0-9]{2}/,
                limitMessage: 'Please input hh format time',
                defaultInput: '00'
            });
            startM = readlineSync.question('mm: ', {
                limit: /[0-5][0-9]/,
                limitMessage: 'Please input mm format time',
                defaultInput: '00'
            });
            startS = readlineSync.question('ss: ', {
                limit: /[0-5][0-9]/,
                limitMessage: 'Please input ss format time',
                defaultInput: '00'
            });
            startMS = readlineSync.question('ms: ', {
                limit: /[0-9][0-9][0-9]/,
                limitMessage: 'Please input ms format time',
                defaultInput: '000'
            });
            start = `${startH}:${startM}:${startS}.${startMS}`;

            durationH = readlineSync.question('Duration hh: ', {
                limit: /[0-9]{2}/,
                limitMessage: 'Please input hh format time',
                defaultInput: '00'
            });
            durationM = readlineSync.question('mm: ', {
                limit: /[0-5][0-9]/,
                limitMessage: 'Please input mm format time',
                defaultInput: '00'
            });
            durationS = readlineSync.question('ss: ', {
                limit: /[0-5][0-9]/,
                limitMessage: 'Please input ss format time',
                defaultInput: '00'
            });
            durationMS = readlineSync.question('ms: ', {
                limit: /[0-9][0-9][0-9]/,
                limitMessage: 'Please input ms format time',
                defaultInput: '000'
            });
            duration = `${durationH}:${durationM}:${durationS}.${durationMS}`;

            console.log(`\nStart: ${start}`);
            console.log(`Duration: ${duration}\n`);

            let doReEncode = readlineSync.question('Re-Encode with H.265? [y|N]: ', {
                limit: /y|N/,
                limitMessage: 'Please input [y|N]',
                defaultInput: 'N'
            });

            let vidEncodeStr = /y/.test(doReEncode) ? '-c:v libx265' : '-c copy';
            let vidEncodeArr = /y/.test(doReEncode) ? ['-c:v', 'libx265'] : ['-c:v', 'copy'];

            lettsStr = /ts/.test(ext) ? '-map 0:v -map 0:a' : '';
            tsArr = /ts/.test(ext) ? ['-map', '0:v', '-map', '0:a'] : [];

            cmdPreview = `ffmpeg -i ${fileName}.${ext} -ss ${start} -t ${duration} ${vidEncodeStr} ${tsStr} ${fileName}_cut.${ext}`;

            args1 = [
                '-i', `${fileName}.${ext}`,
                '-ss', start,
                '-t', duration,
            ];
            args2 = [
                `${fileName}_${start.replace(/:|\./g, '')}_${duration.replace(/:|\./g, '')}_duration_cut.${ext}`
            ];

            args = [...args1, ...vidEncodeArr, ...tsArr, ...args2];
            break;
        // M3U8 合併(test.m3u8)
        case 3:
            cmdPreview = `ffmpeg -protocol_whitelist "file,http,https,tcp,tls,crypto" -allowed_extensions ALL -i test.m3u8 -c copy m3u8_merge.${ext}`;
            args = [
                '-protocol_whitelist', '"file,http,https,tcp,tls,crypto"',
                '-allowed_extensions', 'ALL',
                '-i', 'test.m3u8',
                '-c', 'copy',
                `m3u8_merge.${ext}`
            ];
            break;
        // 影片合併
        case 4:
            let data = '';
            for (let i = 2; i < process.argv.length; i++) {
                let file = process.argv[i];
                data += `file '${file}'\n`;
            }

            let name = process.argv[2];
            name = name.slice(0, file.lastIndexOf('.'));

            fs.writeFileSync('file.txt', data, (err) => {
                if (err) throw err;
                console.log('file.txt saved!\n');
            });

            cmdPreview = `ffmpeg -f concat -safe 0 -i file.txt -c copy ${name}_concat.${ext}`;
            args = [
                '-f', 'concat',
                '-safe', '0',
                '-i', 'file.txt',
                '-c', 'copy',
                `${name}_concat.${ext}`
            ];
            break;
        // 影片 -> 圖片
        case 5:
            startH = readlineSync.question('Start at hh: ', {
                limit: /[0-9]{2}/,
                limitMessage: 'Please input hh format time',
                defaultInput: '00'
            });
            startM = readlineSync.question('mm: ', {
                limit: /[0-5][0-9]/,
                limitMessage: 'Please input mm format time',
                defaultInput: '00'
            });
            startS = readlineSync.question('ss: ', {
                limit: /[0-5][0-9]/,
                limitMessage: 'Please input ss format time',
                defaultInput: '00'
            });
            start = `${startH}:${startM}:${startS}`;

            endH = readlineSync.question('End at hh: ', {
                limit: /[0-9]{2}/,
                limitMessage: 'Please input hh format time',
                defaultInput: '00'
            });
            endM = readlineSync.question('mm: ', {
                limit: /[0-5][0-9]/,
                limitMessage: 'Please input mm format time',
                defaultInput: '00'
            });
            endS = readlineSync.question('ss: ', {
                limit: /[0-5][0-9]/,
                limitMessage: 'Please input ss format time',
                defaultInput: '00'
            });
            end = `${endH}:${endM}:${endS}`;

            console.log(`\nStart: ${start}`);
            console.log(`End: ${end}\n`);

            cmdPreview = `ffmpeg -ss ${start} -t ${end} thumb%04d.jpg -hide_banner -i ${file}`;
            args = [
                '-ss', start,
                '-t', end,
                'thumb%04d.png',
                '-hide_banner',
                '-i', file
            ];
            break;
        // 影片有損縮小大小 & 碼率
        case 6:
            crf = readlineSync.question("crf (Default: 23): ", {
                limit: /[0-9]+/,
                limitMessage: 'crf',
                defaultInput: '23'
            });
            let preset = readlineSync.question("preset (Default: medium): ", {
                limitMessage: 'preset',
                defaultInput: 'medium'
            });
            console.log(`\ncrf: ${crf}\n`);
            console.log(`\preset: ${preset}\n`);

            cmdPreview = `ffmpeg -i ${fileName}.${ext} -c:v libx265 -crf ${crf} -preset ${preset} -c:a copy ${fileName}_re.${ext}`;
            args = [
                '-i', `${fileName}.${ext}`,
                '-c:v', `libx265`,
                '-crf', `${crf}`,
                '-preset', `${preset}`,
                `${fileName}_re.${ext}`
            ];
            break;
        // 移除音軌
        case 7:
            cmdPreview = `ffmpeg -i ${fileName}.${ext} -c:v copy -an ${fileName}_mute.${ext}`;
            args = [
                '-i', `${fileName}.${ext}`,
                '-c:v', `copy`,
                '-an',
                `${fileName}_mute.${ext}`
            ];
            break;
        // 產生 telegram 影片貼圖格式的 webm
        case 8:
            cmdPreview = `ffmpeg -i ${fileName}.${ext} -vf "scale='if(gt(a,1),512,-2)':'if(gt(a,1),-2,512)'" -c:v libvpx-vp9 -an -crf 24 -b:v 0 -r 30 ${fileName}_tg.webm`;
            args = [
                '-i', `${fileName}.${ext}`,
                '-vf', `scale='if(gt(a,1),512,-2)':'if(gt(a,1),-2,512)'`,
                '-c:v', `libvpx-vp9`,
                '-an',
                '-crf', '24',
                '-b:v', '0',
                '-r', '30',
                `${fileName}_tg.webm`
            ];
            break;
        // 影片以固定時間剪輯並產生 telegram 影片貼圖格式的 webm
        case 9:
            startH = readlineSync.question('Start at hh: ', {
                limit: /[0-9]{2}/,
                limitMessage: 'Please input hh format time',
                defaultInput: '00'
            });
            startM = readlineSync.question('mm: ', {
                limit: /[0-5][0-9]/,
                limitMessage: 'Please input mm format time',
                defaultInput: '00'
            });
            startS = readlineSync.question('ss: ', {
                limit: /[0-5][0-9]/,
                limitMessage: 'Please input ss format time',
                defaultInput: '00'
            });
            startMS = readlineSync.question('ms: ', {
                limit: /[0-9][0-9][0-9]/,
                limitMessage: 'Please input ms format time',
                defaultInput: '000'
            });
            start = `${startH}:${startM}:${startS}.${startMS}`;

            durationH = '00';
            durationM = '00';
            durationS = readlineSync.question('Duration for ss: ', {
                limit: /[0][0-2]/,
                limitMessage: 'Please input ss format time, max 02',
                defaultInput: '01'
            });
            durationMS = readlineSync.question('ms: ', {
                limit: /[0-9][0-9][0-9]/,
                limitMessage: 'Please input ms format time',
                defaultInput: '990'
            });
            duration = `${durationH}:${durationM}:${durationS}.${durationMS}`;

            console.log(`\nStart: ${start}`);
            console.log(`Duration: ${duration}\n`);

            lettsStr = /ts/.test(ext) ? '-map 0:v -map 0:a' : '';
            tsArr = /ts/.test(ext) ? ['-map', '0:v', '-map', '0:a'] : [];

            crf = readlineSync.question('crf [24]: ', {
                limit: /[0-9]{1,2}/,
                limitMessage: 'Please input 0~60',
                defaultInput: '24'
            });

            cmdPreview = `ffmpeg -i ${fileName}.${ext} -ss ${start} -t ${duration} -vf "scale='if(gt(a,1),512,-2)':'if(gt(a,1),-2,512)'" -c:v libvpx-vp9 -an -crf ${crf} -b:v 0 -r 30 ${tsStr} ${fileName}_tg.webm`;

            args1 = [
                '-i', `${fileName}.${ext}`,
                '-ss', start,
                '-t', duration,
                '-vf', `scale='if(gt(a,1),512,-2)':'if(gt(a,1),-2,512)'`,
                '-c:v', `libvpx-vp9`,
                '-an',
                '-crf', `${crf}`,
                '-b:v', '0',
                '-r', '30',
            ];

            args2 = [
                `${fileName}_${start.replace(/:|\./g, '')}_${duration.replace(/:|\./g, '')}_cut_tg.webm`
            ];

            args = [...args1, ...tsArr, ...args2];
            break;
        default:
            throw ('\nCommand Not Found!!');
    }

    console.log(`\nExecute Command: ${cmdPreview}\n`);

    let proc = spawn(cmd, args);

    proc.stdout.on('data', function (data) {
        console.log(`[stdout] ${data}`);
    });

    proc.stderr.setEncoding("utf8")
        .on('data', (data) => {
            console.log(`[stderr] ${data}`);
        })
        .on('message', msg => {
            console.log(`[message] ${msg}`);
        })
        .on('error', err => {
            console.log(`[error] ${err}`);
        })
        .on('exit', (code, signal) => {
            console.log(`[exit] code:${code} signal:${signal}`);
        })
        .on('close', () => {
            console.log(`\nExecute Command: ${cmdPreview}\n`);
            console.log(`[close] ${fileName}.${ext} Done`);
        });
} catch (error) {
    console.log(error);
}
