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
    'M3U8 合併(test.m3u8)',
    '影片合併',
    '影片 -> 圖片',
    '影片以固定時間分割(單段)',
    '影片裁切'
];

try {
    if (file == undefined) {
        throw (`Usage: video [fileName] [fileName]......`);
    }

    mode = readlineSync.keyInSelect(modes, '輸入模式：');
    console.log(`\n模式： [${mode + 1}] ${modes[mode]}\n`);
    if (mode !== 0 && mode !== 1) {
        console.log(`檔案： ${file}`);
    }

    let ext = file.slice(file.lastIndexOf('.') + 1);
    let fileName = file.slice(0, file.lastIndexOf('.'));

    if (!(/mp4|ts|tp|mkv/.test(ext))) {
        throw ('\nError: Not Video!!');
    }

    let cmd = 'ffmpeg';
    let cmdPreview = '';
    let start = '';
    let end = '';
    let duration = '';
    let times = '';
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
            start = readlineSync.question('開始時間: ', {
                limit: /[0-9]{2}:[0-9]{2}:[0-9]{2}/,
                limitMessage: '請輸入 hh:mm:ss 格式時間',
                defaultInput: '00:00:00'
            });

            end = readlineSync.question('結束時間: ', {
                limit: /[0-9]{2}:[0-9]{2}:[0-9]{2}/,
                limitMessage: '請輸入 hh:mm:ss 格式時間',
                defaultInput: '99:59:59'
            });
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
            start = readlineSync.question('開始時間: ', {
                limit: /[0-9]{2}:[0-9]{2}:[0-9]{2}/,
                limitMessage: '請輸入 hh:mm:ss 格式時間',
                defaultInput: '00:00:00'
            });

            duration = readlineSync.question('每段時間: ', {
                limit: /[0-9]{2}:[0-9]{2}:[0-9]{2}/,
                limitMessage: '請輸入 hh:mm:ss 格式時間',
                defaultInput: '00:01:00'
            });
            console.log(`\nStart: ${start}`);
            console.log(`Duration: ${duration}\n`);

            cmdPreview = `ffmpeg -ss ${start} -t ${duration} -i ${fileName}.${ext} -acodec copy -vcodec copy ${fileName}_cut.${ext}`;
            args = [
                '-ss', start,
                '-t', duration,
                '-i', `${fileName}.${ext}`,
                '-acodec', 'copy',
                '-vcodec', 'copy',
                `${fileName}_duration_cut.${ext}`
            ];
            break;
        // 影片裁切
        case 4:
            start = readlineSync.question('開始時間: ', {
                limit: /[0-9]{2}:[0-9]{2}:[0-9]{2}/,
                limitMessage: '請輸入 hh:mm:ss 格式時間',
                defaultInput: '00:00:00'
            });
            end = readlineSync.question('結束時間: ', {
                limit: /[0-9]{2}:[0-9]{2}:[0-9]{2}/,
                limitMessage: '請輸入 hh:mm:ss 格式時間',
                defaultInput: '00:01:00'
            });
            console.log(`\nStart: ${start}`);
            console.log(`End: ${end}\n`);

            cmdPreview = `ffmpeg -ss ${start} -to ${end} -i ${fileName}.${ext} -acodec copy -vcodec copy ${fileName}_cut.${ext}`;
            args = [
                '-ss', start,
                '-to', end,
                '-i', `${fileName}.${ext}`,
                '-acodec', 'copy',
                '-vcodec', 'copy',
                `${fileName}_cut.${ext}`
            ];
            break;
        default:
            break;
    }

    console.log(`\nExecute Command: ${cmdPreview}\n`);

    let proc = spawn(cmd, args);

    proc.stdout.on('data', function (data) {
        console.log(data);
    });

    proc.stderr.setEncoding("utf8")
    proc.stderr.on('data', function (data) {
        console.log(data);
    });

    proc.on('close', function () {
        console.log('Done');
    });
} catch (error) {
    console.log(error);
}
