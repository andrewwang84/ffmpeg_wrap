#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const dir = process.argv[2];

const moveRecord = {};

function readDirectory(directory, destination) {
    // Read the contents of the directory
    const contents = fs.readdirSync(directory);

    // Loop through each item in the directory
    contents.forEach((item) => {
        // Get the full path of the item
        const itemPath = path.join(directory, item);

        // Check if the item is a file or a directory
        if (fs.statSync(itemPath).isFile()) {
            // console.log(`File: ${item}`);

            let destinationPath = path.join(destination, item);

            if (moveRecord[destinationPath] != undefined) {
                let indexedItem = item.replace('.', `_${moveRecord[destinationPath]}.`);
                moveRecord[destinationPath] += 1;
                destinationPath = path.join(destination, indexedItem);
            } else {
                moveRecord[destinationPath] = 1;
            }

            fs.renameSync(itemPath, destinationPath);

        } else {
            // If it's a directory, recursively call the function for that directory
            // console.log('Directory:', item);
            readDirectory(itemPath, dir);
        }
    });
}

function doesDirectoryExist(directoryPath) {
    try {
        // Check if the directory exists
        const stats = fs.statSync(directoryPath);

        // Check if it's a directory
        return stats.isDirectory();
    } catch (error) {
        // An error occurred (e.g., directory does not exist)
        return false;
    }
}

(async () => {
    try {
        if (!doesDirectoryExist(dir)) {
            console.log(`The directory '${dir}' does not exist.`);
            return false;
        }

        readDirectory(dir, dir);

        console.log(moveRecord);
    } catch (e) {
        console.error("We've thrown! Whoops!", e);
    }
})();
