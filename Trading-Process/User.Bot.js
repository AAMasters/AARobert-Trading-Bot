exports.newUserBot = function newUserBot(bot, logger) { 

    const MODULE_NAME = "User Bot";
    const FULL_LOG = true;
    const LOG_INFO = true;

    let thisObject = {
        initialize: initialize,
        start: start
    };

    let assistant;
    let gaussStorage;
    let oliviaStorage;

    let genes;

    return thisObject;

    function initialize(pAssistant, pGenes, callBackFunction) {

        try {
            if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] initialize -> Entering function."); }

            logger.fileName = MODULE_NAME;

            assistant = pAssistant;

            let key;

            key = "AAVikings-AAGauss-LRC-Points-Multi-Period-Daily-dataSet.V1";
            gaussStorage = assistant.dataDependencies.dataSets.get(key);

            key = "AAMasters-AAOlivia-Candles-Multi-Period-Daily-dataSet.V1";
            oliviaStorage = assistant.dataDependencies.dataSets.get(key);

            checkGenes(pGenes, callBackFunction);

        } catch (err) {
            logger.write(MODULE_NAME, "[ERROR] initialize -> err = " + err.message);
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }

    function checkGenes(pGenes, callBackFunction) {

        try {
            if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] checkGenes -> Entering function."); }

            function getGeneticRulesByName(pName) {

                for (let i = 0; i < bot.geneticRules.length; i++) {

                    let rule = bot.geneticRules[i];

                    if (rule.name === pName) {

                        return rule;

                    }
                }

                return undefined;
            }

            let buyThreshold = getGeneticRulesByName("buyThreshold");
            let sellThreshold = getGeneticRulesByName("sellThreshold");

            if (
                pGenes.buyThreshold < buyThreshold.lowerLimit      |
                pGenes.buyThreshold > buyThreshold.upperLimit      |
                pGenes.sellThreshold < sellThreshold.lowerLimit    |
                pGenes.sellThreshold > sellThreshold.upperLimit 
                ) 
            {
                logger.write(MODULE_NAME, "[ERROR] getGeneticRules -> Genes received are out of range.");
                logger.write(MODULE_NAME, "[ERROR] getGeneticRules -> pGenes = " + JSON.stringify(pGenes));
                logger.write(MODULE_NAME, "[ERROR] getGeneticRules -> bot.geneticRules = " + JSON.stringify(bot.geneticRules));
                callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                return;
            }

            genes = pGenes;

            callBackFunction(global.DEFAULT_OK_RESPONSE);

        } catch (err) {
            logger.write(MODULE_NAME, "[ERROR] checkGenes -> err = " + err.message);
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }

    function start(callBackFunction) {

        try {

            if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> Entering function."); }

            let market = global.MARKET;
            let lrcFiles = new Map();
            let segmentsPerTimePeriod = new Map();
            let buySignals = new Map();
            let sellSignals = new Map();
            let totalBuyingSignals = 0;      // We count all the buys alerts calculated for all timePeriods.
            let totalSellingSignals = 0;     // We count all the sells alerts calculated for all timePeriods.

            /* 
            This trading bot will use an strategy based on the interpretation of the Linear Regression Curve Channel. LRCs can be calculated at different
            timePeriods. In order to choose which timePeriod to consider at each execution, the bot will first analize the market volatility and
            based on that volatility will choose the timePeriod it understands is best for each situation.

            This bot starts with a BTC investment and buy and sell USDT with the objective in mind to produce BTC profits.

            So this is the Bot's flight plan:

            1.  First we will check if the bot is standing on BTC or USDT. If it is standing on BTC then it must later see if it is appropiate to SELL the BTC or not.
                if it is standing on USDT, it will later see if it is a good time to BUY back BTC. The first run it will be standing in BTC since its investment is in
                BTC. We will see that when the bot in iside a trade (already on USDT), the strategy is to keep the same timePeriod for our analisys that we used to enter
                into that trade.

                For example: The bot decided that 5 min timePeriod was the appropiate one to enter the trade according to market volatility. While in USDT, will just
                analizy LRCs at 5 min timePeriod to guess when it must leave the USDT position.

                Points labeled A, means the path while the bot is on BTC. Points labeled B is the path while the bot is at USDT.

            2.A.First we will get the 1-hr market candle file from Olivia. According to the perceived volatility we will choose a timePeriod to analize if we should
                sell the BTC or not. 

            3.A.We load the LRC file of the timePeriod chosen in 2.A.

            4.A.We analize the LRC file and decide if it is a good time to sell the BTC. If it is we do so.

            2.B.We already know the timePeriod in which we moved into USDT. We load the LRC file for that timePeriod.

            2.C.We analize the file and decide if it is a good time to go back to BTC.

            */

            let timePeriod;

            let currentProfits = assistant.getCombinedProfits();
            let balance = assistant.getBalance();
            let availableBalance = assistant.getAvailableBalance();
            let ROI = assistant.getROI();
            let marketRate = assistant.getMarketRate();

            if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> current economics -> marketRate = " + marketRate); }
            if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> current economics -> currentProfits = " + JSON.stringify(currentProfits)); }
            if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> current economics -> balance = " + JSON.stringify(balance)); }
            if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> current economics -> availableBalance = " + JSON.stringify(availableBalance)); }

            if (ROI.assetA !== null) {

                if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> current economics -> ROI Asset A = " + parseFloat(ROI.assetA).toFixed(2) + " %"); }

            }

            if (ROI.assetB !== null) {

                if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> current economics -> ROI Asset B = " + parseFloat(ROI.assetB).toFixed(2) + " %"); }

            }

            seeWhatWeAreHolding(onDone);

            function onDone(err) {

                try {

                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> onDone -> Entering function."); }

                    switch (err.result) {
                        case global.DEFAULT_OK_RESPONSE.result: {

                            logger.write(MODULE_NAME, "[INFO] start -> onDone -> Execution finished well. :-)");
                            callBackFunction(global.DEFAULT_OK_RESPONSE);
                            return;
                        }
                        case global.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.

                            logger.write(MODULE_NAME, "[ERROR] start -> onDone -> Retry Later. Requesting Execution Retry.");
                            callBackFunction(global.DEFAULT_RETRY_RESPONSE);
                            return;
                        }
                        case global.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.

                            logger.write(MODULE_NAME, "[ERROR] start -> onDone -> Operation Failed. Aborting the process. err = " + err.message);
                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                            return;
                        }
                    }
                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> onDone -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function seeWhatWeAreHolding(callBack) {

                try {

                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> seeWhatWeAreHolding -> Entering function."); }

                    /*
                    The right way to know where we are stanting is to see which positions in the market we still have open. If we do not have any open position
                    then our balance will tell us where we are standing, either over BTC or over USDT.

                    If we do have open opostion, the type of the position will tell us which type of operation we are waiting to be executed. In such a case we
                    will run all the bots logic anyways, since if the conditions are right, we might be able to move that open position to a different rate to
                    get it executed quicklier.

                    */

                    let positions = assistant.getPositions();

                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> seeWhatWeAreHolding -> positions = " + JSON.stringify(positions)); }

                    if (positions.length > 0) {

                        if (positions[0].type === "sell" && positions[0].status === "executed") {

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> seeWhatWeAreHolding -> holdingUSDT because last SELL was executed."); }

                            holdingUSDT(callBack);
                            return;
                        }

                        if (positions[0].type === "buy" && positions[0].status === "executed") {

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> seeWhatWeAreHolding -> holdingBTC because last BUY was executed."); }

                            holdingBTC(callBack);
                            return;

                        }

                    }

                    /*
                    This balance tell us what assests we have. This bot always use all of its assets for each trade, so either BTC is zero or USDT is zero. Of course
                    if BTC is zero, that means that we are standing on USDT and viceversa.
 
                    The market we are working at is USDT/BTC. That means that in this case, AssetA is USDT and AssetB is BTC.
                    */

                    let balance = assistant.getBalance();

                    if (balance.assetA < balance.assetB) {// means that we have more USDT than BTC.

                        if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> seeWhatWeAreHolding -> holdingBTC because balance.assetA < balance.assetB."); }

                        holdingBTC(callBack);

                    } else {

                        if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> seeWhatWeAreHolding -> holdingUSDT because balance.assetA is not < balance.assetB."); }

                        holdingUSDT(callBack);

                    }

                    return;

                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> seeWhatWeAreHolding -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function holdingBTC(callBack) {  // We have BTC and we will search for the best time to sell it for USDT.

                try {

                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> holdingBTC -> Entering function."); }

                    let candlesFile = [];       // Here we will put the content of the files we are going to retrieve from the storage.

                    getCandlesFiles(onCandleFiles);

                    function onCandleFiles() {

                        try {

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> holdingBTC -> onCandleFiles -> Entering function."); }

                            chooseTimePeriod(onTimePeriodChosen);

                            function onTimePeriodChosen() {

                                try {

                                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> holdingBTC -> onCandleFiles -> onTimePeriodChosen -> Entering function."); }

                                    getLRCFiles(onLRCFilesReady);

                                    function onLRCFilesReady() {

                                        try {

                                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> holdingBTC -> onCandleFiles -> onTimePeriodChosen -> onLRCFilesReady -> Entering function."); }

                                            getLRCSegments(onSegmentsReady);
                                            
                                            function onSegmentsReady() {

                                                try {

                                                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> holdingBTC -> onCandleFiles -> onTimePeriodChosen -> onLRCFilesReady -> onSegmentsReady -> Entering function."); }

                                                    checkRules(onceChecked);

                                                    function onceChecked() {

                                                        try {

                                                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> holdingBTC -> onCandleFiles -> onTimePeriodChosen -> onLRCFilesReady -> onSegmentsReady -> onceChecked -> Entering function."); }

                                                            decideIfWeSell(onDecisionMade);

                                                            function onDecisionMade() {

                                                                try {

                                                                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> holdingBTC -> onLRCFilesReady -> onSegmentsReady -> onceChecked -> decideIfWeBuy -> Entering function."); }

                                                                    callBack(global.DEFAULT_OK_RESPONSE);

                                                                } catch (err) {
                                                                    logger.write(MODULE_NAME, "[ERROR] start -> holdingBTC -> onLRCFilesReady -> onSegmentsReady -> onceChecked -> decideIfWeBuy -> err = " + err.message);
                                                                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                                                }
                                                            }

                                                        } catch (err) {
                                                            logger.write(MODULE_NAME, "[ERROR] start -> holdingBTC -> onCandleFiles -> onTimePeriodChosen -> onLRCFilesReady -> onSegmentsReady -> onceChecked -> err = " + err.message);
                                                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                                        }
                                                    }

                                                } catch (err) {
                                                    logger.write(MODULE_NAME, "[ERROR] start -> holdingBTC -> onCandleFiles -> onTimePeriodChosen -> onLRCFilesReady -> onSegmentsReady -> err = " + err.message);
                                                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                                }
                                            }

                                        } catch (err) {
                                            logger.write(MODULE_NAME, "[ERROR] start -> holdingBTC -> onCandleFiles -> onTimePeriodChosen -> onLRCFilesReady -> err = " + err.message);
                                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                        }
                                    }

                                } catch (err) {
                                    logger.write(MODULE_NAME, "[ERROR] start -> holdingBTC -> onCandleFiles -> onTimePeriodChosen -> err = " + err.message);
                                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                }
                            }

                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] start -> holdingBTC -> onCandleFiles -> err = " + err.message);
                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                    function getCandlesFiles(callback) {

                        try {
                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> holdingBTC -> getCandlesFile -> Entering function."); }

                            /*
                            Daily files contains candles of one calendar day. If we are at the begining of a day, we dont have access to the last n
                            candles unless we load also the file from the previous day and join it with the one of the curren day. That is exactly
                            what we are going to do here.
                            */

                            const ONE_DAY_IN_MILISECONDS = 24 * 60 * 60 * 1000;

                            let dateTime = new Date(bot.processDatetime.valueOf());

                            let periodName = "05-min";
                            let datePath = dateTime.getUTCFullYear() + "/" + pad(dateTime.getUTCMonth() + 1, 2) + "/" + pad(dateTime.getUTCDate(), 2);
                            let filePath = "Candles/Multi-Period-Daily/" + periodName + "/" + datePath;
                            let fileName = market.assetA + '_' + market.assetB + ".json"

                            oliviaStorage.getTextFile(filePath, fileName, onFileReceived);

                            function onFileReceived(err, text) {

                                try {

                                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> holdingBTC -> getCandlesFile -> onFileReceived -> Entering Function."); }

                                    if (err.result === global.DEFAULT_OK_RESPONSE.result) {

                                        let processDayCandlesFile = JSON.parse(text);

                                        let dateTime = new Date(bot.processDatetime.valueOf() - ONE_DAY_IN_MILISECONDS);

                                        let periodName = "05-min";
                                        let datePath = dateTime.getUTCFullYear() + "/" + pad(dateTime.getUTCMonth() + 1, 2) + "/" + pad(dateTime.getUTCDate(), 2);
                                        let filePath = "Candles/Multi-Period-Daily/" + periodName + "/" + datePath;
                                        let fileName = market.assetA + '_' + market.assetB + ".json"

                                        oliviaStorage.getTextFile(filePath, fileName, onFileReceived);

                                        function onFileReceived(err, text) {

                                            try {

                                                if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> holdingBTC -> getCandlesFile -> onFileReceived -> onFileReceived -> Entering Function."); }

                                                if (err.result === global.DEFAULT_OK_RESPONSE.result) {

                                                    let previousDayCandlesFile = JSON.parse(text);

                                                    for (let i = 0; i < previousDayCandlesFile.length; i++) {

                                                        let record = previousDayCandlesFile[i];
                                                        candlesFile.push(record);

                                                    }

                                                    for (let i = 0; i < processDayCandlesFile.length; i++) {

                                                        let record = processDayCandlesFile[i];
                                                        candlesFile.push(record);

                                                    }

                                                    callback();

                                                } else {

                                                    if (err.result === global.CUSTOM_FAIL_RESPONSE.result &&
                                                        err.message === 'File does not exist.') {

                                                        /*
                                                        We dont see a real situation where this file could not exist, but even if once that happen, we will assume it is something temporary and we
                                                        will RETRY later.
                                                        */

                                                        callBackFunction(global.DEFAULT_RETRY_RESPONSE);
                                                        return;
                                                    }

                                                    logger.write(MODULE_NAME, "[ERROR] start -> holdingBTC -> getCandlesFile -> onFileReceived -> onFileReceived -> Error received from storage.");
                                                    logger.write(MODULE_NAME, "[ERROR] start -> holdingBTC -> getCandlesFile -> onFileReceived -> onFileReceived -> err.message = " + err.message);

                                                    callBackFunction(err);
                                                    return;
                                                }

                                            } catch (err) {
                                                logger.write(MODULE_NAME, "[ERROR] start -> holdingBTC -> getCandlesFile -> onFileReceived -> onFileReceived -> err = " + err.message);
                                                callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                            }
                                        }

                                    } else {

                                        if (err.result === global.CUSTOM_FAIL_RESPONSE.result &&
                                            err.message === 'File does not exist.') {

                                            /* At the begining of each new day, the bot might try to read daily files from indicator bots that still dont exist. We just RETRY later. */

                                            callBackFunction(global.DEFAULT_RETRY_RESPONSE);
                                            return;
                                        }

                                        logger.write(MODULE_NAME, "[ERROR] start -> holdingBTC -> getCandlesFile -> onFileReceived -> Error received from storage.");
                                        logger.write(MODULE_NAME, "[ERROR] start -> holdingBTC -> getCandlesFile -> onFileReceived -> err.message = " + err.message);

                                        callBackFunction(err);
                                        return;
                                    }

                                } catch (err) {
                                    logger.write(MODULE_NAME, "[ERROR] start -> holdingBTC -> getCandlesFile -> onFileReceived -> err = " + err.message);
                                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                }
                            }

                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] start -> holdingBTC -> getCandlesFile -> err = " + err.message);
                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                    function chooseTimePeriod(callback) {

                        try {

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> holdingBTC -> chooseTimePeriod -> Entering function."); }

                            /* 
                            According to the plan, we will see how volatile the market currently is and decide which timePeriod to work with.
                            Since we currently dont have an indicator for the standard deviation, which is the measure of volatility,
                            we will implement its logic right here.
         
                            Acording to this site: http://stockcharts.com/school/doku.php?id=chart_school:technical_indicators:standard_deviation_volatility
         
                            Introduction
         
                            Standard deviation is a statistical term that measures the amount of variability or dispersion around an average.
                            Standard deviation is also a measure of volatility. Generally speaking, dispersion is the difference between the actual value
                            and the average value. The larger this dispersion or variability is, the higher the standard deviation. The smaller this
                            dispersion or variability is, the lower the standard deviation. Chartists can use the standard deviation to measure expected risk
                            and determine the significance of certain price movements.
         
                            Calculation
         
                            StockCharts.com calculates the standard deviation for a population, which assumes that the periods involved represent the whole
                            data set, not a sample from a bigger data set. The calculation steps are as follows:
         
                            1. Calculate the average (mean) price for the number of periods or observations.
                            2. Determine each period's deviation (close less average price).
                            3. Square each period's deviation.
                            4. Sum the squared deviations.
                            5. Divide this sum by the number of observations.
                            6. The standard deviation is then equal to the square root of that number.
         
                            */

                            /*
                            0. Get the periods of observation. In our case we will use the last 3 hours, that would mean the last 36 candles on the file before
                            the bots process date.
                            */

                            const TOTAL_CANDLES = 36;

                            if (candlesFile.length < TOTAL_CANDLES) {
                                logger.write(MODULE_NAME, "[ERROR] start -> getCandlesFile -> onFileReceived -> Less than 1 hs of Market History.");
                                callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                return;
                            }

                            let candles = [];
                            let currentCandleIndex = 0;

                            for (let i = 0; i < candlesFile.length; i++) {

                                let candle = {
                                    open: candlesFile[i][2],
                                    close: candlesFile[i][3],
                                    min: candlesFile[i][0],
                                    max: candlesFile[i][1],
                                    begin: candlesFile[i][4],
                                    end: candlesFile[i][5]
                                };

                                currentCandleIndex = i;

                                if (candle.begin >= bot.processDatetime.valueOf()) {

                                    currentCandleIndex--;
                                    break;
                                }
                            }

                            for (let i = 0; i < TOTAL_CANDLES; i++) {

                                let candle = {
                                    open: candlesFile[i + currentCandleIndex - TOTAL_CANDLES + 1][2],
                                    close: candlesFile[i + currentCandleIndex - TOTAL_CANDLES + 1][3],
                                    min: candlesFile[i + currentCandleIndex - TOTAL_CANDLES + 1][0],
                                    max: candlesFile[i + currentCandleIndex - TOTAL_CANDLES + 1][1],
                                    begin: candlesFile[i + currentCandleIndex - TOTAL_CANDLES + 1][4],
                                    end: candlesFile[i + currentCandleIndex - TOTAL_CANDLES + 1][5]
                                };

                                candles.push(candle);

                            }

                            /* 1. Calculate the average (mean) price for the number of periods or observations. */

                            for (let i = 0; i < candles.length; i++) {

                                candle = candles[i];
                                candle.avg = (candle.min + candle.max) / 2;

                            }

                            let average = 0;

                            for (let i = 0; i < candles.length; i++) {

                                candle = candles[i];
                                average = average + candle.avg;

                            }

                            average = average / candles.length;

                            /* 2. Determine each period's deviation (close less average price). */

                            for (let i = 0; i < candles.length; i++) {

                                candle = candles[i];
                                candle.deviation = Math.abs(candle.close - average);

                            }

                            /* 3. Square each period's deviation. */

                            for (let i = 0; i < candles.length; i++) {

                                candle = candles[i];
                                candle.sqrt = Math.sqrt(candle.deviation);

                            }

                            /* 4. Sum the squared deviations. */

                            let sum = 0;

                            for (let i = 0; i < candles.length; i++) {

                                candle = candles[i];
                                sum = sum + candle.sqrt;

                            }

                            /* 5. Divide this sum by the number of observations. */

                            let dividedSum = sum / candles.length;

                            /* 6. The standard deviation is then equal to the square root of that number.*/

                            let standardDeviation = Math.sqrt(dividedSum);

                            /* Next we are going to decide which timePeriod to use. The following procedure is arbitrary and the result of observing the charts. */

                            if (standardDeviation >= 0 && standardDeviation < 1) {

                                timePeriod = "03-min";
                            }

                            if (standardDeviation >= 1 && standardDeviation < 2) {

                                timePeriod = "04-min";
                            }

                            if (standardDeviation >= 2 && standardDeviation < 2.4) {

                                timePeriod = "05-min";
                            }

                            if (standardDeviation >= 2.4 && standardDeviation < 2.6) {

                                timePeriod = "10-min";
                            }

                            if (standardDeviation >= 2.6 && standardDeviation < 2.8) {

                                timePeriod = "30-min";
                            }

                            if (standardDeviation >= 2.8 && standardDeviation < 3.0) {

                                timePeriod = "40-min";
                            }

                            if (standardDeviation >= 3 && standardDeviation < 3.5) {

                                timePeriod = "45-min";
                            }

                            if (standardDeviation >= 3.5 && standardDeviation < 4) {

                                timePeriod = "01-hs";
                            }

                            if (standardDeviation >= 4 && standardDeviation < 4.5) {

                                timePeriod = "02-hs";
                            }

                            if (standardDeviation >= 4.5 && standardDeviation < 5) {

                                timePeriod = "06-hs";
                            }

                            if (standardDeviation >= 5 && standardDeviation < 100) {

                                timePeriod = "24-hs";
                            }

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> holdingBTC -> chooseTimePeriod -> standardDeviation = " + standardDeviation); }
                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> holdingBTC -> chooseTimePeriod -> timePeriod = " + timePeriod); }

                            /* Ok, here we are done.       */

                            callback();

                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] start -> holdingBTC -> chooseTimePeriod -> err = " + err.message);
                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> holdingBTC -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function holdingUSDT(callBack) {  // We have USDT and we will search for the best time to buy BTC.

                try {

                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> holdingUSDT -> Entering function."); }

                    timePeriod = assistant.remindMeOf("timePeriod");

                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> holdingUSDT -> timePeriod = " + timePeriod); }

                    getLRCFiles(onLRCFilesReady);

                    function onLRCFilesReady() {

                        try {

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> holdingUSDT -> onLRCFilesReady -> Entering function."); }

                            getLRCSegments(onSegmentsReady);

                            function onSegmentsReady() {

                                try {

                                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> holdingUSDT -> onLRCFilesReady -> onSegmentsReady -> Entering function."); }

                                    checkRules(onceChecked);

                                    function onceChecked() {

                                        try {

                                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> holdingUSDT -> onLRCFilesReady -> onSegmentsReady -> onceChecked -> Entering function."); }

                                            decideIfWeBuy(onDecisionMade);

                                            function onDecisionMade() {

                                                try {

                                                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> holdingUSDT -> onLRCFilesReady -> onSegmentsReady -> onceChecked -> decideIfWeBuy -> Entering function."); }

                                                    callBack(global.DEFAULT_OK_RESPONSE);

                                                } catch (err) {
                                                    logger.write(MODULE_NAME, "[ERROR] start -> holdingUSDT -> onLRCFilesReady -> onSegmentsReady -> onceChecked -> decideIfWeBuy -> err = " + err.message);
                                                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                                }
                                            }

                                        } catch (err) {
                                            logger.write(MODULE_NAME, "[ERROR] start -> holdingUSDT -> onLRCFilesReady -> onSegmentsReady -> onceChecked -> err = " + err.message);
                                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                        }
                                    }

                                } catch (err) {
                                    logger.write(MODULE_NAME, "[ERROR] start -> holdingUSDT -> onLRCFilesReady -> onSegmentsReady -> err = " + err.message);
                                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                }
                            }

                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] start -> holdingUSDT -> onLRCFilesReady -> err = " + err.message);
                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> holdingUSDT -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function getLRCFiles(callback) {

                try {
                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCFiles -> Entering function."); }

                    let totalFilesExpected = global.dailyFilePeriods.length + global.marketFilesPeriods.length;
                    let totalFilesRequestReponses = 0;
                    let totalOk = 0;

                    getLRCDailyFiles(onFileRequestResponse);
                    getLRCMarketFiles(onFileRequestResponse);

                    function onFileRequestResponse(err) {

                        try {

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCFiles -> onFileRequestResponse -> Entering function."); }

                            totalFilesRequestReponses++;

                            if (err.result === global.DEFAULT_OK_RESPONSE.result) {

                                totalOk++;

                            }

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCFiles -> onFileRequestResponse -> totalFilesRequestReponses = " + totalFilesRequestReponses); }
                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCFiles -> onFileRequestResponse -> totalFilesExpected = " + totalFilesExpected); }
                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCFiles -> onFileRequestResponse -> totalOk = " + totalOk); }

                            if (totalFilesRequestReponses === totalFilesExpected) {

                                if (totalFilesRequestReponses === totalOk) {

                                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCFiles -> onFileRequestResponse -> All LRC files loaded well."); }

                                    callback();

                                } else {

                                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCFiles -> onFileRequestResponse -> Some LRC files NOT loaded."); }

                                    callBackFunction(global.DEFAULT_RETRY_RESPONSE);

                                }
                            }

                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] start -> getLRCFiles -> onFileRequestResponse -> err = " + err.message);
                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> getLRCFiles -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function getLRCDailyFiles(callback) {

                try {
                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCDailyFiles -> Entering function."); }

                    /* Here we will get all the different daily files to be able to see at every scale what is going on at the market. */

                    for (let i = 0; i < global.dailyFilePeriods.length; i++) {

                        let timePeriodName = global.dailyFilePeriods[i][1];

                        getLRCDailyFile(timePeriodName, callback)

                    }

                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> getLRCDailyFiles -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function getLRCDailyFile(pTimePeriodName, callback) {

                /*
                Note here in this function how we do not use callBackFunction even in errors, since this functin is called in parallel multiple times and at an event
                of an error in all executions, that would multiply the running threads. Insted callbac is used at every possible path.
                */

                try {

                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCDailyFile -> Entering function."); }

                    /*
                    Daily files contains LRC segments of one calendar day. If we are at the begining of a day, we dont have access to the last n
                    segments unless we load also the file from the previous day and join it with the one of the curren day. That is exactly
                    what we are going to do here.
                    */

                    const ONE_DAY_IN_MILISECONDS = 24 * 60 * 60 * 1000;

                    let dateTime = new Date(bot.processDatetime.valueOf());

                    let datePath = dateTime.getUTCFullYear() + "/" + pad(dateTime.getUTCMonth() + 1, 2) + "/" + pad(dateTime.getUTCDate(), 2);
                    let filePath = "LRC-Points/Multi-Period-Daily/" + pTimePeriodName + "/" + datePath;
                    let fileName = market.assetA + '_' + market.assetB + ".json"

                    gaussStorage.getTextFile(filePath, fileName, onFileReceived);

                    function onFileReceived(err, text) {

                        try {

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCDailyFile -> onFileReceived -> Entering Function."); }

                            if (err.result === global.DEFAULT_OK_RESPONSE.result) {

                                let processDayLRCFile = JSON.parse(text);

                                let dateTime = new Date(bot.processDatetime.valueOf() - ONE_DAY_IN_MILISECONDS);

                                let datePath = dateTime.getUTCFullYear() + "/" + pad(dateTime.getUTCMonth() + 1, 2) + "/" + pad(dateTime.getUTCDate(), 2);
                                let filePath = "LRC-Points/Multi-Period-Daily/" + pTimePeriodName + "/" + datePath;
                                let fileName = market.assetA + '_' + market.assetB + ".json"

                                gaussStorage.getTextFile(filePath, fileName, onFileReceived);

                                function onFileReceived(err, text) {

                                    try {

                                        if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCDailyFile -> onFileReceived -> onFileReceived -> Entering Function."); }

                                        let lrcFile = [];

                                        if (err.result === global.DEFAULT_OK_RESPONSE.result) {

                                            let previousDayLRCFile = JSON.parse(text);

                                            for (let i = 0; i < previousDayLRCFile.length; i++) {

                                                let record = previousDayLRCFile[i];
                                                lrcFile.push(record);

                                            }

                                            for (let i = 0; i < processDayLRCFile.length; i++) {

                                                let record = processDayLRCFile[i];
                                                lrcFile.push(record);

                                            }

                                            lrcFiles.set(pTimePeriodName, lrcFile);

                                            callback(global.DEFAULT_OK_RESPONSE);

                                        } else {

                                            if (err.result === global.CUSTOM_FAIL_RESPONSE.result &&
                                                err.message === 'File does not exist.') {

                                                /*
                                                We dont see a real situation where this file could not exist, but even if once that happen, we will assume it is something temporary and we
                                                will RETRY later.
                                                */

                                                callback(global.DEFAULT_RETRY_RESPONSE);
                                                return;
                                            }

                                            logger.write(MODULE_NAME, "[ERROR] start -> getLRCDailyFile -> onFileReceived -> onFileReceived -> Error received from storage.");
                                            logger.write(MODULE_NAME, "[ERROR] start -> getLRCDailyFile -> onFileReceived -> onFileReceived -> err.message = " + err.message);

                                            callback(err);
                                            return;
                                        }

                                    } catch (err) {
                                        logger.write(MODULE_NAME, "[ERROR] start -> getLRCDailyFile -> onFileReceived -> onFileReceived -> err = " + err.message);
                                        callback(global.DEFAULT_FAIL_RESPONSE);
                                    }
                                }

                            } else {

                                if (err.result === global.CUSTOM_FAIL_RESPONSE.result &&
                                    err.message === 'File does not exist.') {

                                    /* At the begining of each new day, the bot might try to read daily files from indicator bots that still dont exist. We just RETRY later. */

                                    callback(global.DEFAULT_RETRY_RESPONSE);
                                    return;
                                }

                                logger.write(MODULE_NAME, "[ERROR] start -> getLRCDailyFile -> onFileReceived -> Error received from storage.");
                                logger.write(MODULE_NAME, "[ERROR] start -> getLRCDailyFile -> onFileReceived -> err.message = " + err.message);

                                callback(err);
                                return;
                            }

                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] start -> getLRCDailyFile -> onFileReceived -> err = " + err.message);
                            callback(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> getLRCDailyFile -> err = " + err.message);
                    callback(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function getLRCMarketFiles(callback) {

                try {
                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCMarketFiles -> Entering function."); }

                    /* Here we will get all the different market files to be able to see at a macro scale what is going on at the market. */

                    for (let i = 0; i < global.marketFilesPeriods.length; i++) {

                        let timePeriodName = global.marketFilesPeriods[i][1];

                        getLRCMarketFile(timePeriodName, callback)

                    }

                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> getLRCMarketFiles -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function getLRCMarketFile(pTimePeriodName, callback) {

                /*
                Note here in this function how we do not use callBackFunction even in errors, since this functin is called in parallel multiple times and at an event
                of an error in all executions, that would multiply the running threads. Insted callbac is used at every possible path.
                */

                try {
                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCMarketFile -> Entering function."); }

                    /*
                    Market files contains LRC segments for the whole market. This means we only need one file.
                    */

                    let filePath = "LRC-Points/Multi-Period-Market/" + pTimePeriodName;
                    let fileName = market.assetA + '_' + market.assetB + ".json"

                    gaussStorage.getTextFile(filePath, fileName, onFileReceived);

                    function onFileReceived(err, text) {

                        try {

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCMarketFile -> onFileReceived -> Entering Function."); }

                            let lrcFile = [];

                            if (err.result === global.DEFAULT_OK_RESPONSE.result) {

                                lrcFile = JSON.parse(text);

                                lrcFiles.set(pTimePeriodName, lrcFile);

                                callback(global.DEFAULT_OK_RESPONSE);

                            } else {

                                logger.write(MODULE_NAME, "[ERROR] start -> getLRCMarketFile -> onFileReceived -> Error received from storage.");
                                logger.write(MODULE_NAME, "[ERROR] start -> getLRCMarketFile -> onFileReceived -> err.message = " + err.message);

                                callback(err);
                                return;
                            }

                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] start -> getLRCMarketFile -> onFileReceived -> err = " + err.message);
                            callback(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> getLRCMarketFile -> err = " + err.message);
                    callback(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function getLRCSegments(callback) {

                try {

                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCSegments -> Entering function."); }

                    let totalExpected = global.dailyFilePeriods.length + global.marketFilesPeriods.length;
                    let totalCalculated = 0;

                    for (let i = 0; i < global.marketFilesPeriods.length; i++) {

                        let timePeriodName = global.marketFilesPeriods[i][1];
                        let lrcFile = lrcFiles.get(timePeriodName);

                        getLRCSegment(lrcFile, timePeriodName, onSegmentReady)

                    }

                    for (let i = 0; i < global.dailyFilePeriods.length; i++) {

                        let timePeriodName = global.dailyFilePeriods[i][1];
                        let lrcFile = lrcFiles.get(timePeriodName);

                        getLRCSegment(lrcFile, timePeriodName, onSegmentReady)

                    }

                    function onSegmentReady() {

                        try {

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCSegments -> onSegmentReady -> Entering function."); }

                            totalCalculated++;

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCSegments -> onSegmentReady -> totalCalculated = " + totalCalculated); }
                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCSegments -> onSegmentReady -> totalExpected = " + totalExpected); }

                            if (totalCalculated === totalExpected) {

                                callback();

                            }

                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] start -> getLRCFiles -> onSegmentReady -> err = " + err.message);
                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> getLRCSegments -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function getLRCSegment(pLrcFile, pTimePeriodName, callback) {

                try {

                    if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCSegment -> Entering function."); }

                    let previousLrcPoint;
                    let currentLrcPoint;

                    for (let i = 1 /* start at 1 to be able to read the previous object */; i < pLrcFile.length; i++) {

                        previousLrcPoint = {
                            begin: pLrcFile[i - 1][0],
                            end: pLrcFile[i - 1][1],
                            value15: pLrcFile[i - 1][2],
                            value30: pLrcFile[i - 1][3],
                            value60: pLrcFile[i - 1][4]
                        };

                        currentLrcPoint = {
                            begin: pLrcFile[i][0],
                            end: pLrcFile[i][1],
                            value15: pLrcFile[i][2],
                            value30: pLrcFile[i][3],
                            value60: pLrcFile[i][4]
                        };

                        if (currentLrcPoint.begin >= bot.processDatetime.valueOf()) {

                            /* While we are backtesting, it should enter here.*/

                            calculateSegments(previousLrcPoint, currentLrcPoint);
                            return;
                        }
                    }

                    /* 
                    While it is running live or in cometition mode, it should enter here.
                    In those cases we need to verify that the LRC points are not too old to be considered valid. That could happen if the indicator that produces it or any
                    of its dependencies is not running or is late. We consider the LRC points too old when the last one on the set closed more than five minutes before the
                    current bot process time.
                    */

                    const FIVE_MINUTES_IN_MILISECONDS = 5 * 60 * 1000;

                    if (currentLrcPoint.close < bot.processDatetime.valueOf() - FIVE_MINUTES_IN_MILISECONDS) {

                        logger.write(MODULE_NAME, "[ERROR] start -> getLRCSegment -> LRC points too old.");
                        logger.write(MODULE_NAME, "[ERROR] start -> getLRCSegment -> Cannot continue processing. Retrying later. ");

                        callBackFunction(global.DEFAULT_RETRY_RESPONSE);
                        return;
                    }

                    calculateSegments(previousLrcPoint, currentLrcPoint);
                    return;

                    function calculateSegments(previousLrcPoint, currentLrcPoint) {

                        try {

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCSegment -> calculateSegments -> Entering function."); }

                            /* First we create the segments and put there the point values */

                            let segments = {
                                value15: {
                                    first: previousLrcPoint.value15,
                                    last: currentLrcPoint.value15,
                                },
                                value30: {
                                    first: previousLrcPoint.value30,
                                    last: currentLrcPoint.value30,
                                },
                                value60: {
                                    first: previousLrcPoint.value60,
                                    last: currentLrcPoint.value60,
                                }
                            };

                            /* Second we define the direction of each segment. */

                            if (segments.value15.first === segments.value15.last) {
                                segments.value15.direction = "horizontal";
                            }

                            if (segments.value30.first === segments.value30.last) {
                                segments.value30.direction = "horizontal";
                            }

                            if (segments.value60.first === segments.value60.last) {
                                segments.value60.direction = "horizontal";
                            }

                            if (segments.value15.first < segments.value15.last) {
                                segments.value15.direction = "up";
                            }

                            if (segments.value30.first < segments.value30.last) {
                                segments.value30.direction = "up";
                            }

                            if (segments.value60.first < segments.value60.last) {
                                segments.value60.direction = "up";
                            }

                            if (segments.value15.first > segments.value15.last) {
                                segments.value15.direction = "down";
                            }

                            if (segments.value30.first > segments.value30.last) {
                                segments.value30.direction = "down";
                            }

                            if (segments.value60.first > segments.value60.last) {
                                segments.value60.direction = "down";
                            }

                            /* Finally we define the position of each segment. */

                            segments.value15.position = "middle";
                            segments.value30.position = "middle";
                            segments.value60.position = "middle";

                            if (segments.value15.last > segments.value30.last &&
                                segments.value15.last > segments.value60.last) {

                                segments.value15.position = "top";

                            }

                            if (segments.value30.last > segments.value15.last &&
                                segments.value30.last > segments.value60.last) {

                                segments.value30.position = "top";

                            }

                            if (segments.value60.last > segments.value15.last &&
                                segments.value60.last > segments.value30.last) {

                                segments.value60.position = "top";

                            }

                            if (segments.value15.last < segments.value30.last &&
                                segments.value15.last < segments.value60.last) {

                                segments.value15.position = "bottom";

                            }

                            if (segments.value30.last < segments.value15.last &&
                                segments.value30.last < segments.value60.last) {

                                segments.value30.position = "bottom";

                            }

                            if (segments.value60.last < segments.value15.last &&
                                segments.value60.last < segments.value30.last) {

                                segments.value60.position = "bottom";

                            }

                            segmentsPerTimePeriod.set(pTimePeriodName, segments);

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, "[INFO] start -> getLRCSegment -> calculateSegments -> segments = " + JSON.stringify(segments)); }

                            callback();

                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] start -> getLRCSegment -> calculateSegments -> err = " + err.message);
                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> getLRCSegment -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function checkRules(callback) {

                try {

                    if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> checkRules -> Entering function."); }

                    /* The first part of this function will generate the buy or sell alerts at each different possible timePeriod. */

                    for (let i = 0; i < global.marketFilesPeriods.length; i++) {

                        let timePeriodName = global.marketFilesPeriods[i][1];
                        let segments = segmentsPerTimePeriod.get(timePeriodName);

                        checkSellRules(segments, timePeriodName);
                        checkBuyRules(segments, timePeriodName);

                    }

                    for (let i = 0; i < global.dailyFilePeriods.length; i++) {

                        let timePeriodName = global.dailyFilePeriods[i][1];
                        let segments = segmentsPerTimePeriod.get(timePeriodName);

                        checkSellRules(segments, timePeriodName)
                        checkBuyRules(segments, timePeriodName);
                    }

                    /* The second part of this function is going to evaluate all the alerts and calculate an overall score, both for buying or for selling. */

                    for (let i = 0; i < global.marketFilesPeriods.length; i++) {

                        let timePeriodName = global.marketFilesPeriods[i][1];

                        let buySignal = buySignals.get(timePeriodName);
                        let sellSignal = sellSignals.get(timePeriodName);

                        if (buySignal === true) { totalBuyingSignals++; }
                        if (sellSignal === true) { totalSellingSignals++; }

                    }

                    for (let i = 0; i < global.dailyFilePeriods.length; i++) {

                        let timePeriodName = global.dailyFilePeriods[i][1];

                        let buySignal = buySignals.get(timePeriodName);
                        let sellSignal = sellSignals.get(timePeriodName);

                        if (buySignal === true) { totalBuyingSignals++; }
                        if (sellSignal === true) { totalSellingSignals++; }

                    }

                    callback();

                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> checkRules -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function checkSellRules(pSegments, pTimePeriodName) {

                try {

                    if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> checkSellRules -> Entering function."); }
                    if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> checkSellRules -> pSegments = " + JSON.stringify(pSegments)); }
                    if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> checkSellRules -> pTimePeriodName = " + pTimePeriodName); }

                    /*
    
                    The sell rules for this bot are the following:
    
                    Rule #1: Segment 60 must be on top, followed by segment 30 at the middle and segment 15 at the bottom.
                    Rule #2: All segments must be going down.
    
                    */

                    if (
                        pSegments.value60.position === "top" &&
                        pSegments.value30.position === "middle" &&
                        pSegments.value15.position === "bottom") {

                        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> checkSellRules -> Segments positions are correct."); }

                    } else {

                        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> checkSellRules -> Segments not in the right position."); }
                        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> checkSellRules -> Not selling BTC this time."); }

                        sellSignals.set(pTimePeriodName, false);
                        return;
                    }

                    if (
                        pSegments.value60.direction === "down" &&
                        pSegments.value30.direction === "down" &&
                        pSegments.value15.direction === "down") {

                        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> checkSellRules -> Segments directions are correct."); }

                    } else {

                        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> checkSellRules -> Some of the segments were not going down."); }
                        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> checkSellRules -> Not selling BTC this time."); }

                        sellSignals.set(pTimePeriodName, false);
                        return;

                    }

                    sellSignals.set(pTimePeriodName, true);

                    return;

                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> checkSellRules -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function checkBuyRules(pSegments, pTimePeriodName) {

                try {

                    if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> checkBuyRules -> Entering function."); }
                    if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> checkBuyRules -> pSegments = " + JSON.stringify(pSegments)); }
                    if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> checkBuyRules -> pTimePeriodName = " + pTimePeriodName); }

                    /*
    
                    The buy rules for this bot are the following:
    
                    Rule #1: Segment 60 must be at the bottom, followed by segment 30 at the middle and segment 15 at the top.
                    Rule #2: All segments must be going up.
    
                    */

                    if (
                        pSegments.value60.position === "bottom" &&
                        pSegments.value30.position === "middle" &&
                        pSegments.value15.position === "top"
                    ) {

                        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> checkBuyRules -> Segments positions are correct."); }

                    } else {

                        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> checkBuyRules -> Segments not in the right position."); }
                        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> checkBuyRules -> Not buying BTC this time."); }

                        buySignals.set(pTimePeriodName, false);
                        return;
                    }

                    if (
                        pSegments.value60.direction === "up" &&
                        pSegments.value30.direction === "up" &&
                        pSegments.value15.direction === "up") {

                        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> checkBuyRules -> Segments directions are correct."); }

                    } else {

                        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> checkBuyRules -> Some of the segments were not going up."); }
                        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> checkBuyRules -> Not buying BTC this time."); }

                        buySignals.set(pTimePeriodName, false);
                        return;

                    }

                    buySignals.set(pTimePeriodName, true);
                    return;

                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> checkBuyRules -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function decideIfWeSell(callback) {

                try {

                    if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> decideIfWeSell -> Entering function."); }
                    if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> decideIfWeSell -> totalSellingSignals = " + totalSellingSignals); }
                    if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> decideIfWeSell -> totalBuyingSignals = " + totalBuyingSignals); }
                    
                    if (totalSellingSignals <= totalBuyingSignals) {

                        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> decideIfWeSell -> It makes more sense to BUY than to SELL. Not Selling now."); }
                        callback();
                        return;
                    }

                    if (totalSellingSignals <= genes.sellThreshold) { // There are 19 possible timePeriods. We need than this threadhold to call a SELL. 

                        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> decideIfWeSell -> Not enought selling signals. Not Selling now."); }
                        callback();
                        return;
                    }
                    
                    if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> decideIfWeSell -> This is the right time to SELL. Selling now."); }
                    createSellPosition(callback);

                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> decideIfWeSell -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function decideIfWeBuy(callback) {

                try {

                    if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> decideIfWeBuy -> Entering function."); }
                    if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> decideIfWeBuy -> totalSellingSignals = " + totalSellingSignals); }
                    if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> decideIfWeBuy -> totalBuyingSignals = " + totalBuyingSignals); }
                    
                    if (totalBuyingSignals <= totalSellingSignals) {

                        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> decideIfWeBuy -> It makes more sense to SELL than to BUY. Not Buying now."); }
                        callback();
                        return;
                    }

                    if (totalBuyingSignals <= genes.buyThreshold) { // There are 19 possible timePeriods. We need more than this threadhold to call a BUY. 

                        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> decideIfWeBuy -> Not enought buying signals. Not Buying now."); }
                        callback();
                        return;
                    }
                    
                    if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> decideIfWeBuy -> This is the right time to BUY. Buying now."); }
                    createBuyPosition(callback);

                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> decideIfWeBuy -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function createSellPosition(callback) {

                try {

                    if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createSellPosition -> Entering function."); }

                    let positions = assistant.getPositions();
                    let availableBalance = assistant.getAvailableBalance().assetB;
                    let currentRate = assistant.getTicker().bid;
                    let amountB = assistant.getAvailableBalance().assetB;
                    let amountA = assistant.truncDecimals(amountB * currentRate);

                    currentRate = assistant.truncDecimals(currentRate);
                    amountA = assistant.truncDecimals(amountA);
                    amountB = assistant.truncDecimals(amountB);

                    if (positions.length > 0 && positions[0].type === "sell" && positions[0].status !== "executed") {

                        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createSellPosition -> Moving SELL position."); }

                        assistant.movePosition(positions[0], currentRate, onMoved);
                        return;

                        function onMoved(err) {

                            try {

                                if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createSellPosition -> onMoved -> Entering function."); }

                                if (err.result !== global.DEFAULT_OK_RESPONSE.result) {

                                    logger.write(MODULE_NAME, "[ERROR] start -> createSellPosition -> onMoved -> Error received from the Assistant.");
                                    logger.write(MODULE_NAME, "[ERROR] start -> createSellPosition -> onMoved -> err.message = " + err.message);

                                    callBackFunction(err);
                                    return;
                                }

                                if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createSellPosition -> onMoved -> BTC SELL position moved. "); }
                                if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createSellPosition -> onMoved -> currentRate = " + currentRate); }
                                if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createSellPosition -> onMoved -> previous position = " + JSON.stringify(positions[0])); }

                                let message = "I have moved an existing SELL position to this new rate: " + currentRate;
                                assistant.sendMessage(0, "Moving SELL BTC Position", message);

                                callback();
                                return;

                            } catch (err) {
                                logger.write(MODULE_NAME, "[ERROR] start -> createSellPosition -> onMoved -> err = " + err.message);
                                callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                            }
                        }
                    }

                    assistant.putPosition("sell", currentRate, amountA, amountB, onSell);

                    function onSell() {

                        try {

                            if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createSellPosition -> onSell -> Entering function."); }

                            if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createSellPosition -> onSell -> BTC SELL position created. "); }
                            if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createSellPosition -> onSell -> currentRate = " + currentRate); }
                            if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createSellPosition -> onSell -> amountA = " + amountA); }
                            if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createSellPosition -> onSell -> amountB = " + amountB); }

                            let message = "I have created a new SELL position at rate: " + currentRate + ". " + MARKET.assetA + " amount: " + amountA + ". " + MARKET.assetB + " amount: " + amountB + ". ROI.assetB:" + ROI.assetB;
                            assistant.sendMessage(0, "Selling BTC", message);

                            /* We need to remember the timePeriod for the next bot executions. Until we dont exit USDT we will keep the same timePeriod we used to enter. */
                            assistant.rememberThis("timePeriod", timePeriod);

                            callback();
                            return;

                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] start -> createSellPosition -> onSell -> err = " + err.message);
                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> createSellPosition -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function createBuyPosition(callback) {

                try {

                    if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createBuyPosition -> Entering function."); }

                    let positions = assistant.getPositions();
                    let availableBalance = assistant.getAvailableBalance().assetA;
                    let currentRate = assistant.getTicker().ask;
                    let amountA = assistant.getAvailableBalance().assetA;
                    let amountB = assistant.truncDecimals(amountA / currentRate);

                    currentRate = assistant.truncDecimals(currentRate);
                    amountA = assistant.truncDecimals(amountA);
                    amountB = assistant.truncDecimals(amountB);

                    if (positions.length > 0 && positions[0].type === "buy" && positions[0].status !== "executed") {

                        if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createBuyPosition -> Moving BUY position."); }

                        assistant.movePosition(positions[0], currentRate, onMoved);
                        return;

                        function onMoved(err) {

                            try {

                                if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createBuyPosition -> onMoved -> Entering function."); }

                                if (err.result !== global.DEFAULT_OK_RESPONSE.result) {

                                    logger.write(MODULE_NAME, "[ERROR] start -> createBuyPosition -> onMoved -> Error received from the Assistant.");
                                    logger.write(MODULE_NAME, "[ERROR] start -> createBuyPosition -> onMoved -> err.message = " + err.message);

                                    callBackFunction(err);
                                    return;
                                }

                                if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createBuyPosition -> onMoved -> BTC BUY position moved. "); }
                                if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createBuyPosition -> onMoved -> currentRate = " + currentRate); }
                                if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createBuyPosition -> onMoved -> previous position = " + JSON.stringify(positions[0])); }

                                let message = "I have moved an existing BUY position to this new rate: " + currentRate;
                                assistant.sendMessage(0, "Moving BUY BTC Position", message);

                                callback();
                                return;

                            } catch (err) {
                                logger.write(MODULE_NAME, "[ERROR] start -> createBuyPosition -> onMoved -> err = " + err.message);
                                callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                            }
                        }
                    }

                    assistant.putPosition("buy", currentRate, amountA, amountB, onBuy);

                    function onBuy() {

                        try {

                            if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createBuyPosition -> onBuy -> Entering function."); }

                            if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createBuyPosition -> onBuy -> BTC BUY position created. "); }
                            if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createBuyPosition -> onBuy -> currentRate = " + currentRate); }
                            if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createBuyPosition -> onBuy -> amountA = " + amountA); }
                            if (LOG_INFO === true) { logger.write(MODULE_NAME, "[INFO] start -> createBuyPosition -> onBuy -> amountB = " + amountB); }

                            let message = "I have created a new BUY position at rate: " + currentRate + ". " + MARKET.assetA + " amount: " + amountA + ". " + MARKET.assetB + " amount: " + amountB + ". ROI.assetB:" + ROI.assetB;
                            assistant.sendMessage(0, "Buying BTC", message);

                            callback();
                            return;

                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] start -> createBuyPosition -> onBuy -> err = " + err.message);
                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] start -> createBuyPosition -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function pad(str, max) {
                str = str.toString();
                return str.length < max ? pad("0" + str, max) : str;
            }

        } catch (err) {
            logger.write(MODULE_NAME, "[ERROR] start -> err = " + err.message);
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }
}