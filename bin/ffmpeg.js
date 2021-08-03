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
    'M3U8 Merge(test.m3u8)',
    'Video Concat',
    'Video -> Thumbnails',
    'Cut Video by Duration',
    'Cut Video by Time',
    'Add Watermark'
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
    '878:692',
    '1518:1052',
    '678:1892',
    '3438:2132',
    '1758:3814',
    '3694:2132',
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
        throw (`Usage: video [fileName] [fileName]......`);
    }

    mode = readlineSync.keyInSelect(modes, 'Enter Mode: ');
    console.log(`\nMode: [${mode + 1}] ${modes[mode]}\n`);
    if (mode !== 0 && mode !== 1) {
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
    switch (mode) {
        // M3U8 合併(test.m3u8)
        case 0:
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
        case 1:
            let data = '';
            for (let i = 2; i < process.argv.length; i++) {
                let file = process.argv[i];
                data += `file "${file}"\n`;
            }

            fs.writeFileSync('file.txt', data, (err) => {
                if (err) throw err;
                console.log('file.txt saved!\n');
            });

            cmdPreview = `ffmpeg -f concat -i file.txt -c copy concat.${ext}`;
            args = [
                '-f', 'concat',
                '-i', 'file.txt',
                '-c', 'copy',
                `concat.${ext}`
            ];
            break;
        // 影片 -> 圖片
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
        // 影片以固定時間分割(單段)
        case 3:
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
            duration = `${durationH}:${durationM}:${durationS}`;

            console.log(`\nStart: ${start}`);
            console.log(`Duration: ${duration}\n`);

            cmdPreview = `ffmpeg -ss ${start} -t ${duration} -i ${fileName}.${ext} -acodec copy -vcodec copy ${fileName}_cut.${ext}`;
            args = [
                '-ss', start,
                '-t', duration,
                '-i', `${fileName}.${ext}`,
                '-acodec', 'copy',
                '-vcodec', 'copy',
                `${fileName}_${start.replace(/:/g, '')}_${duration.replace(/:/g, '')}_duration_cut.${ext}`
            ];
            break;
        // 加浮水印
        case 5:
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
                markPos = `${w - 402}:${h - 28}`;
            } else {
                let sizes = vidSize.split('x');
                w = sizes[0];
                h = sizes[1];
            }

            switch (markPosMode) {
                // 右上
                case 1:
                    let offsetW = w - 402;
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

            cmdPreview = `ffmpeg -i ${fileName}.${ext} -i Logo-crop2.png -filter_complex "overlay=${markPos}" ${fileName}_watermark.${ext}`;
            args = [
                '-i', `${fileName}.${ext}`,
                '-i', `Logo-crop2.png`,
                '-filter_complex', `overlay=${markPos}`,
                `${fileName}_watermark.${ext}`
            ];
            break;
        // 影片裁切
        case 4:
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

            cmdPreview = `ffmpeg -ss ${start} -to ${end} -i ${fileName}.${ext} -acodec copy -vcodec copy ${fileName}_cut.${ext}`;
            args = [
                '-ss', start,
                '-to', end,
                '-i', `${fileName}.${ext}`,
                '-acodec', 'copy',
                '-vcodec', 'copy',
                `${fileName}_${start.replace(/:/g, '')}_${end.replace(/:/g, '')}_cut.${ext}`
            ];
        default:
            break;
    }

    console.log(`\nExecute Command: ${cmdPreview}\n`);

    let proc = spawn(cmd, args);

    proc.stdout.on('data', function (data) {
        console.log(`stdout: ${data}`);
    });

    proc.stderr.setEncoding("utf8")
    proc.stderr.on('data', function (data) {
        console.log(`stderr: ${data}`);
    });

    proc.on('close', function () {
        console.log('Done');
    });
} catch (error) {
    console.log(error);
}
