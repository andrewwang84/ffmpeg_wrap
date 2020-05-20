#!/usr/bin/env node

// npm i -g .
// npm uninstall -g ffmpeg_wrap
// npm ls -g --depth=0
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
    'Cut Video by Time'
];

try {
    if (file == undefined) {
        throw (`Usage: video [fileName] [fileName]......`);
    }

    mode = readlineSync.keyInSelect(modes, 'Enter Mode：');
    console.log(`\nMode： [${mode + 1}] ${modes[mode]}\n`);
    if (mode !== 0 && mode !== 1) {
        console.log(`File： ${file}`);
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
            break;
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
