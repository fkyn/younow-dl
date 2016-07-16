# younow-dl

List, download and record younow streams

## Features

 - Record live broadcast
 - List and download past broadcasts
 - Download broadcasts by URI

## Install

Install ffmpeg and rtmpdump on your system and make them available in $PATH. Than install the project:

```
npm install younow-dl -g
```

## Usage

```
#help
younow-dl -h
younow-dl live -h
younow-dl user -h
younow-dl uri -h

#Record a live broadcast of a specific user
younow-dl live Some_User0815

#Record a live broadcast of a specific user, will wait until one is available
younow-dl live Some_User0815 -w

#List available past broadcasts of a specific user and select one to download
younow-dl user Some_User0815

#Download a broadcast by URI
younow-dl uri https://www.younow.com/Some_User0815/112012387/12358484/101/b

```

## Author

fkyn <fkyn@gmx.de>

## License

MIT
