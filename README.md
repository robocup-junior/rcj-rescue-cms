# RoboCupJunior CMS 2025
This is a scoring system used in RoboCupJunior's rescue line & maze competition.

For a japan version of this README, see [README-JP.md](./README-JP.md)

## Supported rules
* 2025 rules published by International RoboCupJunior Rescue Technical Committee
* 2025 rules published by Japanese Regional Committee for entry leagues
* 
## Demo
The latest version is running. It is built using Docker image and working under OCI arm instance.

[https://osaka.rcj.cloud](https://osaka.rcj.cloud)

## List of competitions using this system
### 2016 rule
* Swedish national competitions
* RoboCup Junior 2017 Kanto (Japanese local competition)
* RoboCup Junior Japan Open 2017 Gifu-Nakatsugawa (Japanese national competition)

### 2017 rules
* RoboCup 2017 Nagoya Japan
* NEST Robocon 2017
* RoboCup Junior 2018 North-Saitama (Japanese local competition)
* RoboCup Junior 2018 South-Saitama (Japanese local competition)
* RoboCup Junior 2018 Chiba (Japanese local competition)
* RoboCup Junior 2018 Hiroshima-node (Japanese local competition)
* RoboCup Junior 2018 Osaka-Central (Japanese local competition)
* RoboCup Junior 2018 Saitama (Japanese local competition)
* RoboCup Junior 2018 Kanto (Japanese local competition)
* RoboCup Junior 2018 Hiroshima (Japanese local competition)
* RoboCup Junior 2018 Kansai (Japanese local competition)
* RoboCup Junior Japan Open 2018 Wakayama (Japanese national competition)

### 2018 rules
* RoboCup 2018 Montreal Canada
* Kansai Summer Open Competition 2018

### 2019 rules
* RoboCup Junior 2019 Tokai (Japanese local competition)
* RoboCup Junior 2019 Saitama (Japanese local competition)
* RoboCup Junior 2019 Hiroshima (Japanese local competition)
* RoboCup Junior 2019 Osaka-Central (Japanese local competition)
* RoboCup Junior 2019 Kansai (Japanese local competition)
* RoboCup Junior 2019 Kanto (Japanese local competition)
* RoboCup Junior Japan Open 2019 Wakayama (Japanese national competition)
* RoboCup 2019 Sydney Australia
* RoboCup Junior 2020 Osaka-Central (Japanese local competition)
* RoboCup Junior 2020 Kansai (Japanese local competition)

### 2021 rules
* RoboCup Junior 2021 Tokai (Japanese local competition)
* RoboCupJunior Japan 2021 Online (Japanese national competition)
* RoboCup2021 WORLDWIDE

### 2022 rules
* RoboCup 2022 Bangkok Thailand

### 2023 rules
* RoboCup Junior 2023 Tokai (Japanese local competition)
* RoboCup Junior 2023 Kansai (Japanese local competition)
* RoboCup Junior 2023 Kanto (Japanese local competition)
* RoboCup Junior 2023 Hiroshima (Japanese local competition)
* RoboCup Junior Japan Open 2023 Nagoya (Japanese national competition)
* Torneo Mexicano de Robótica 2023 (Mexican national competition)
* RoboCup 2023 Bordeaux France

### 2024 rules
* RoboCup Junior Japan Open 2024 Nagoya
* RoboCup 2024 Eindhoven

### 2025 rules
* RoboCup Junior Japan Open 2025 Nagoya
* RoboCup 2025 Salvador
* RoboCup Junior German Open 2026 (German local competition)

## Usage
### Using Docker（Recommended）
Use the  [Official docker image](https://hub.docker.com/r/ryorobo/rcj-cms/tags) is strongly recommended.  
This docker image supports the following architectures.  
* linux/amd64
* linux/arm/v6
* linux/arm/v7
* linux/arm64

For detail, please check [helper files](https://github.com/robocup-junior/rcj-cms-docker-helper) to set-up your environment.

### Without using docker
#### Dependent software
* [Node.js](https://nodejs.org/en/)
* [mongodb](https://www.mongodb.com)
* [Redis](https://redis.io)

### Install bower
`sudo npm install -g bower`

### Build dependency
`npm install`  
`bower install`  
`npm run build`  

### Make directory
`mkdir logs`

### Startup
`node server`

## Default account
The default account is as follows.

User name        | Password         |
----------------|-------------------|
admin | adminpass   |

## Sample(in Japanese)
Home(2019)
<img src="https://raw.githubusercontent.com/rrrobo/rcj-rescue-scoring-japan/master/rcjj-scoring/1.png">
<hr>
Login
<img src="https://raw.githubusercontent.com/rrrobo/rcj-rescue-scoring-japan/master/rcjj-scoring/6.png">
<hr>
Line runs
<img src="https://raw.githubusercontent.com/rrrobo/rcj-rescue-scoring-japan/master/rcjj-scoring/2.png">
<hr>
Line Judge 1 
<img src="https://raw.githubusercontent.com/rrrobo/rcj-rescue-scoring-japan/master/rcjj-scoring/3.png">
<hr>
Line Judge 2
<img src="https://raw.githubusercontent.com/rrrobo/rcj-rescue-scoring-japan/master/rcjj-scoring/4.png">
<hr>
Line Sign
<img src="https://raw.githubusercontent.com/rrrobo/rcj-rescue-scoring-japan/master/rcjj-scoring/5.png">
<hr>
Maze Judge
<img src="https://raw.githubusercontent.com/rrrobo/rcj-rescue-scoring-japan/master/rcjj-scoring/7.png">
<hr>

### Sound credit
 
* [MusMus](http://musmus.main.jp)
* [魔王魂](https://maoudamashii.jokersounds.com)
