// /usr/local/bin/node ~/Documents/projects/trigger_stream_download.js www.tiktok.com/@amazonmusic/live "241122 TWICE - Amazon Music Live Backstage with TWICE_tiktok.ts"
// /usr/local/bin/node ~/Documents/projects/trigger_stream_download.js www.twitch.tv/AmazonMusic "241122 TWICE - Amazon Music Live_twitch.ts"
const spawn = require('child_process').spawn;

const arguments = process.argv.slice(2);
const [url, filename] = arguments;
let streamFound = true;
let attempts = 0;
// 持續10分鐘
const interval = 5000;
const maxMinutes = 10;
let maxAttempts = maxMinutes * 60 * 1000 / interval;

argsStream = [
    'best',
    `-o`, `~/Downloads/${filename}`
];

let cmdPreview = `${url} best -o ~/Downloads/${filename}`;

argsOption = [];
if (/twitch\.tv/.test(url)) {
    cmdPreview = `--twitch-disable-ads ${url} best -o "~/Downloads/${filename}"`;
    argsOption = [
        '--twitch-disable-ads'
    ];
} else {
    cmdPreview = `--retry-streams 5 --retry-max 100 --retry-open 100 --stream-segment-attempts 10 ${url} best -o "~/Downloads/${filename}"`;
    argsOption = [
        '--retry-streams', '5',
        '--retry-max', '100',
        '--retry-open', '100',
        '--stream-segment-attempts', '10'
    ];
}

cmdPreview = `Streamlink ${cmdPreview}`;

args = [...argsOption, ...[url], ...argsStream];

console.info(`\nGoing to run command: ${cmdPreview}\n`);

let proc = spawn('Streamlink', args);
proc.stdout.setEncoding("utf8").on('data', function (data) {
    console.info(`${data}`);

    if (/No playable streams found/.test(data)) {
        streamFound = false;
        console.error(`Streams not found, retry every ${interval/1000} seconds for ${maxMinutes} minutes`);
    }
});

proc.stderr.setEncoding("utf8")
    .on('data', (data) => {
        console.error(`[error] ${data}`);
    })
    .on('message', msg => {
        console.info(`[message] ${msg}`);
    })
    .on('exit', (code, signal) => {
        console.error(`[exit] code:${code} signal:${signal}`);
    })
    .on('close', () => {
        console.info(`[close] Done`);

        if (streamFound == false) {
            const retryInterval = setInterval(() => {
                if (attempts >= maxAttempts) {
                    console.log(`Exceeded maximum retry attempts (${maxMinutes}minutes). Stopping.`);
                    clearInterval(retryInterval);
                    return;
                }
                attempts++;
                console.log(`Retry attempt ${attempts}/${maxAttempts}`);
                proc = spawn('Streamlink', args);
                streamFound = true;
                proc.stdout.setEncoding("utf8").on('data', function (data) {
                    if (/No playable streams found/.test(data)) {
                        streamFound = false;
                    }
                });
                proc.stderr.setEncoding("utf8").on('close', () => {
                    if (streamFound) {
                        clearInterval(retryInterval);
                        console.info(`[close] Retry Done`);
                    }
                });
            }, 5000);
        }
    });
