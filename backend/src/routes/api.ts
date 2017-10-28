import {NextFunction, Request, Response, Router} from 'express';
import QuizManager, {default as QuizManagerDAO} from '../db/quiz-manager';
import * as fs from 'fs';
import * as path from 'path';
import {IQuestionGroup} from '../interfaces/questions/interfaces';
import {ISessionConfiguration} from '../interfaces/session_configuration/interfaces';
import availableNicks from '../nicknames/availableNicks';
import {themes} from '../themes/availableThemes';
import {IActiveQuiz, INickname, IQuizResponse} from '../interfaces/common.interfaces';
import {DatabaseTypes, DbDao} from '../db/DbDao';
import {ExcelWorkbook} from '../export/excel-workbook';
import {server} from 'websocket';

const serverConfig = {
  cacheQuizAssets: true
};

export class ApiRouter {
  get router(): Router {
    return this._router;
  }

  private _router: Router;

  /**
   * Initialize the ApiRouter
   */
  constructor() {
    this._router = Router();
    this.init();
  }

  /**
   * GET all Data.
   * TODO: Return REST Spec here
   */
  public getAll(req: Request, res: Response, next: NextFunction): void {
    res.send({
      serverConfig
    });
  }

  public getThemes(req: Request, res: Response, next: NextFunction): void {
    res.send({
      status: 'STATUS:SUCCESSFULL',
      step: 'GET_THEMES',
      payload: themes
    });
  }

  public getFavicon(req: Request, res: Response, next: NextFunction): void {
    const imagePath = req.params.themeId ? `favicons/${req.params.themeId}` : `arsnova_click_small`;
    res.send(fs.readFileSync(path.join(__dirname, `../../images/${imagePath}.png`)));
  }

  public getTheme(req: Request, res: Response, next: NextFunction): void {
    res.send(fs.readFileSync(path.join(__dirname, `../../images/themes/${req.params.themeId}_${req.params.languageId}.png`)));
  }

  public getIsAvailableQuiz(req: Request, res: Response, next: NextFunction): void {
    const quizzes: Array<string> = QuizManager.getAllActiveQuizNames();
    const quizExists: boolean = quizzes.indexOf(req.params.quizName) > -1;
    const payload: { available?: boolean, provideNickSelection?: boolean, authorizeViaCas?: boolean } = {};

    const isInactive: boolean = QuizManager.isInactiveQuiz(req.params.quizName);

    if (quizExists) {
      const sessionConfig: ISessionConfiguration = QuizManager.getActiveQuizByName(req.params.quizName).originalObject.sessionConfig;
      const provideNickSelection: boolean = sessionConfig.nicks.selectedNicks.length > 0;

      payload.available = true;
      payload.provideNickSelection = provideNickSelection;
      payload.authorizeViaCas = sessionConfig.nicks.restrictToCasLogin;
    }

    const result: Object = {
      status: `STATUS:SUCCESS`,
      step: `QUIZ:${quizExists ? 'AVAILABLE' : isInactive ? 'EXISTS' : 'UNDEFINED'}`,
      payload
    };
    res.send(result);
  }

  public generateDemoQuiz(req: Request, res: Response, next: NextFunction): void {
    try {
      const result: IQuestionGroup = JSON.parse(fs.readFileSync(path.join(__dirname, '../../demo_quiz/de.demo_quiz.json')).toString());
      result.hashtag = 'Demo Quiz ' + (QuizManager.getAllActiveDemoQuizzes().length + 1);
      QuizManager.convertLegacyQuiz(result);
      res.setHeader('Response-Type', 'text/plain');
      res.send(result);
    } catch (ex) {
      res.send(`File IO Error: ${ex}`);
    }
  }

  public getAllAvailableNicks(req: Request, res: Response, next: NextFunction): void {
    res.send(availableNicks);
  }

  public putOpenLobby(req: Request, res: Response, next: NextFunction): void {
    QuizManager.initActiveQuiz(req.body.quiz);
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'LOBBY:OPENED',
      payload: req.body.quiz
    });
  }

  public putCloseLobby(req: Request, res: Response, next: NextFunction): void {
    const result: boolean = QuizManager.removeActiveQuiz(req.body.quizName);
    const response: Object = {status: `STATUS:${result ? 'SUCCESSFUL' : 'FAILED'}`};
    if (result) {
      Object.assign(response, {
        step: 'LOBBY:CLOSED',
        payload: {}
      });
    }
    res.send(response);
  }

  public addMember(req: Request, res: Response, next: NextFunction): void {
    const activeQuiz: IActiveQuiz = QuizManager.getActiveQuizByName(req.body.quizName);
    try {
      const webSocketAuthorization: number = Math.random();
      activeQuiz.addMember(req.body.nickname, webSocketAuthorization);
      res.send({
        status: 'STATUS:SUCCESSFUL',
        step: 'LOBBY:MEMBER_ADDED',
        payload: {
          member: activeQuiz.nicknames[activeQuiz.nicknames.length - 1].serialize(),
          nicknames: activeQuiz.nicknames.map((value: INickname) => {
            return value.serialize();
          }),
          sessionConfiguration: activeQuiz.originalObject.sessionConfig,
          webSocketAuthorization: webSocketAuthorization
        }
      });
    } catch (ex) {
      res.send({
        status: 'STATUS:FAILED',
        step: 'LOBBY:MEMBER_ADDED',
        payload: {message: ex.message}
      });
    }
  }

  public deleteMember(req: Request, res: Response, next: NextFunction): void {
    const activeQuiz: IActiveQuiz = QuizManager.getActiveQuizByName(req.params.quizName);
    const result: boolean = activeQuiz.removeMember(req.params.nickname);
    const response: Object = {status: `STATUS:${result ? 'SUCCESSFUL' : 'FAILED'}`};
    if (result) {
      Object.assign(response, {
        step: 'LOBBY:MEMBER_REMOVED',
        payload: {}
      });
    }
    res.send(response);
  }

  public getAllMembers(req: Request, res: Response, next: NextFunction): void {
    const activeQuiz: IActiveQuiz = QuizManager.getActiveQuizByName(req.params.quizName);
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:GET_MEMBERS',
      payload: {
        nicknames: activeQuiz.nicknames.map((value: INickname) => {
          return value.serialize();
        })
      }
    });
  }

  public uploadQuiz(req: Request, res: Response, next: NextFunction): void {
    const duplicateQuizzes = [];
    const quizData = [];
    let privateKey = '';
    // noinspection TypeScriptUnresolvedVariable
    if (req.busboy) {
      const promise = new Promise((resolve) => {
        req.busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
          if (fieldname === 'uploadFiles[]') {
            let quiz = '';
            file.on('data', (buffer) => {
              console.log(buffer.toString('utf8'));
              const part = buffer.toString('utf8');
              quiz += part;
              console.log('stream data ' + part);
            });
            file.on('end', () => {
              console.log('final output ' + quiz);
              quizData.push({
                fileName: filename,
                quiz: JSON.parse(quiz)
              });
            });
          }
          console.log('file', fieldname, file, filename, encoding, mimetype);
        });
        req.busboy.on('field', function(key, value, keyTruncated, valueTruncated) {
          if (key === 'privateKey') {
            privateKey = value;
          }
        });
        req.busboy.on('finish', function() {
          console.log('form parsing finished');
          console.log('result finish', quizData, privateKey);
          resolve();
        });
        req.pipe(req.busboy);
      });
      promise.then(() => {
        quizData.forEach((data: {fileName: string, quiz: IQuestionGroup}) => {
          const dbResult = DbDao.read(DatabaseTypes.quiz, {quizName: data.quiz.hashtag});
          if (dbResult) {
            duplicateQuizzes.push({
              quizName: data.quiz.hashtag,
              fileName: data.fileName,
              renameRecommendation: QuizManagerDAO.getRenameRecommendations(data.quiz.hashtag)
            });
          } else {
            DbDao.create(DatabaseTypes.quiz, {quizName: data.quiz.hashtag, privateKey});
            if (serverConfig.cacheQuizAssets) {
              // TODO: Cache assets if the server setting is enabled
            }
          }
        });
        res.send({status: 'STATUS:SUCCESSFUL', step: 'QUIZ:UPLOAD_FILE', payload: {duplicateQuizzes}});
      });
    } else {
      res.send({status: 'STATUS:FAILED', step: 'QUIZ:UPLOAD_FILE', payload: {message: 'busboy not found'}});
    }
  }

  public startQuiz(req: Request, res: Response, next: NextFunction): void {
    const activeQuiz: IActiveQuiz = QuizManager.getActiveQuizByName(req.body.quizName);
    if (activeQuiz.currentStartTimestamp) {
      res.send({
        status: 'STATUS:FAILED',
        step: 'QUIZ:ALREADY_STARTED',
        payload: {startTimestamp: activeQuiz.currentStartTimestamp, nextQuestionIndex: activeQuiz.currentQuestionIndex}
      });
    } else {
      const nextQuestionIndex: number = activeQuiz.nextQuestion();
      if (nextQuestionIndex === -1) {
        res.send({
          status: 'STATUS:FAILED',
          step: 'QUIZ:END_OF_QUESTIONS',
          payload: {}
        });
      } else {
        const startTimestamp: number = new Date().getTime();
        activeQuiz.setTimestamp(startTimestamp);
        res.send({
          status: 'STATUS:SUCCESSFUL',
          step: 'QUIZ:START',
          payload: {startTimestamp, nextQuestionIndex}
        });
      }
    }
  }

  public getQuizStartTime(req: Request, res: Response, next: NextFunction): void {
    const activeQuiz: IActiveQuiz = QuizManager.getActiveQuizByName(req.params.quizName);
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:GET_STARTTIME',
      payload: {startTimestamp: activeQuiz.currentStartTimestamp}
    });
  }

  public updateQuizSettings(req: Request, res: Response, next: NextFunction): void {
    const activeQuiz: IActiveQuiz = QuizManager.getActiveQuizByName(req.body.quizName);
    activeQuiz.updateQuizSettings(req.body.target, req.body.state);
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:UPDATED_SETTINGS',
      payload: {}
    });
  }

  public reserveQuiz(req: Request, res: Response, next: NextFunction): void {
    if (!req.body.quizName || !req.body.privateKey) {
      res.send({
        status: 'STATUS:FAILED',
        step: 'QUIZ:INVALID_DATA',
        payload: {}
      });
      return;
    }
    QuizManager.initInactiveQuiz(req.body.quizName, req.body.privateKey);
    DbDao.create(DatabaseTypes.quiz, {quizName: req.body.quizName, privateKey: req.body.privateKey});
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:RESERVED',
      payload: {}
    });
  }

  public deleteQuiz(req: Request, res: Response, next: NextFunction): void {
    if (!req.body.quizName || !req.body.privateKey) {
      res.send({
        status: 'STATUS:FAILED',
        step: 'QUIZ:INVALID_DATA',
        payload: {}
      });
      return;
    }
    const dbResult: boolean = DbDao.delete(DatabaseTypes.quiz, {quizName: req.body.quizName, privateKey: req.body.privateKey});
    if (dbResult) {
      QuizManager.removeQuiz(req.body.quizName);
      res.send({
        status: 'STATUS:SUCCESS',
        step: 'QUIZ:REMOVED',
        payload: {}
      });
    } else {
      res.send({
        status: 'STATUS:FAILED',
        step: 'QUIZ:INSUFFICIENT_PERMISSIONS',
        payload: {}
      });
    }
  }

  public deleteActiveQuiz(req: Request, res: Response, next: NextFunction): void {
    if (!req.body.quizName || !req.body.privateKey) {
      res.send({
        status: 'STATUS:FAILED',
        step: 'QUIZ:INVALID_DATA',
        payload: {}
      });
      return;
    }
    const activeQuiz: IActiveQuiz = QuizManager.getActiveQuizByName(req.body.quizName);
    const dbResult: Object = DbDao.read(DatabaseTypes.quiz, {quizName: req.body.quizName, privateKey: req.body.privateKey});
    if (activeQuiz && dbResult) {
      QuizManager.removeActiveQuiz(req.body.quizName);
      res.send({
        status: 'STATUS:SUCCESS',
        step: 'QUIZ:CLOSED',
        payload: {}
      });
    } else {
      res.send({
        status: 'STATUS:FAILED',
        step: 'QUIZ:INSUFFICIENT_PERMISSIONS',
        payload: {}
      });
    }
  }

  public resetQuiz(req: Request, res: Response, next: NextFunction): void {
    const activeQuiz: IActiveQuiz = QuizManager.getActiveQuizByName(req.params.quizName);
    activeQuiz.reset();
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:RESET',
      payload: {}
    });
  }

  public getRemainingNicks(req: Request, res: Response, next: NextFunction): void {
    const activeQuiz: IActiveQuiz = QuizManager.getActiveQuizByName(req.params.quizName);
    const names: Array<String> = activeQuiz.originalObject.sessionConfig.nicks.selectedNicks.filter((nick) => {
      return activeQuiz.nicknames.filter(value => value.name === nick).length === 0;
    });
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:GET_REMAINING_NICKS',
      payload: {nicknames: names}
    });
  }

  public addMemberResponse(req: Request, res: Response, next: NextFunction): void {
    const activeQuiz: IActiveQuiz = QuizManager.getActiveQuizByName(req.body.quizName);
    if (activeQuiz.nicknames.filter(value => {
        return value.name === req.body.nickname;
      })[0].responses[activeQuiz.currentQuestionIndex]) {
      res.send({
        status: 'STATUS:FAILED',
        step: 'QUIZ:DUPLICATE_MEMBER_RESPONSE',
        payload: {}
      });
      return;
    }

    if (typeof req.body.value === 'undefined' || !req.body.responseTime) {
      res.send({
        status: 'STATUS:FAILED',
        step: 'QUIZ:INVALID_MEMBER_RESPONSE',
        payload: {}
      });
      return;
    }

    activeQuiz.addResponse(req.body.nickname, activeQuiz.currentQuestionIndex, <IQuizResponse>{
      value: req.body.value,
      responseTime: parseInt(req.body.responseTime, 10),
      confidence: parseInt(req.body.confidence, 10) || 0, // TODO: Separate to extra update method
      readingConfirmation: req.body.readingConfirmation || false // TODO: Separate to extra update method
    });

    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:ADD_MEMBER_RESPONSE',
      payload: {}
    });
  }

  public setMemberConfidenceRate(req: Request, res: Response, next: NextFunction): void {
    const activeQuiz: IActiveQuiz = QuizManager.getActiveQuizByName(req.body.quizName);
    activeQuiz.nicknames.filter((member) => {
      return member.name === req.body.nickname;
    })[0].responses[req.body.questionIndex].confidence = req.body.confidenceValue;
    res.send({
      status: 'STATUS:SUCCESSFULL',
      step: 'QUIZ:CONFIDENCE_VALUE',
      payload: {}
    });
  }

  public setMemberReadingConfirmation(req: Request, res: Response, next: NextFunction): void {
    const activeQuiz: IActiveQuiz = QuizManager.getActiveQuizByName(req.body.quizName);
    activeQuiz.nicknames.filter((member) => {
      return member.name === req.body.nickname;
    })[0].responses[req.body.questionIndex].readingConfirmation = true;
    res.send({
      status: 'STATUS:SUCCESSFULL',
      step: 'QUIZ:READING_CONFIRMATION',
      payload: {}
    });
  }

  public getExportFile(req: Request, res: Response, next: NextFunction): void {
    const activeQuiz: IActiveQuiz = QuizManager.getActiveQuizByName(req.params.quizName);
    const dbResult: Object = DbDao.read(DatabaseTypes.quiz, {quizName: req.params.quizName, privateKey: req.params.privateKey});

    if (!dbResult) {
      res.writeHead(500);
      res.send({
        status: 'STATUS:FAILED',
        step: 'EXPORT:QUIZ_NOT_FOUND',
        payload: {}
      });
      return;
    }
    if (!activeQuiz) {
      res.writeHead(500);
      res.send({
        status: 'STATUS:FAILED',
        step: 'EXPORT:QUIZ_INACTIVE',
        payload: {}
      });
      return;
    }
    const wb = new ExcelWorkbook({
      themeName: req.params.theme,
      translation: req.params.language,
      quiz: activeQuiz,
    });
    const date: Date = new Date();
    const dateFormatted = `${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}-${date.getHours()}_${date.getMinutes()}`;
    wb.write(`Export-${req.params.quizName}-${dateFormatted}.xlsx`, res);
  }

  public randomFile(dir: string): Promise<string> {
    return new Promise((resolve) => {
      fs.readdir(dir, (err, items) => {
        resolve(items[Math.floor(Math.random() * items.length)]);
      });
    });
  }

  public getFileByName(req: Request, res: Response, next: NextFunction): void {
    const pathToFiles: string = path.join(__dirname, `../../${req.params.directory}/${req.params.subdirectory}`);
    if (req.params.fileName.indexOf('Random') > -1) {
      this.randomFile(pathToFiles).then((file: string) => {
        res.send(fs.readFileSync(file));
      });
    } else {
      res.send(fs.readFileSync(`${pathToFiles}/${req.params.fileName}`));
    }
  }

  /**
   * Take each handler, and attach to one of the Express.Router's
   * endpoints.
   */
  private init(): void {
    this._router.get('/', this.getAll);

    this._router.get('/favicon/:themeId?', this.getFavicon);
    this._router.get('/themes', this.getThemes);
    this._router.get('/theme/:themeId/:languageId', this.getTheme);

    this._router.get('/getAvailableQuiz/:quizName', this.getIsAvailableQuiz);

    this._router.get('/demoquiz/generate', this.generateDemoQuiz);

    this._router.get('/availableNicks/all', this.getAllAvailableNicks);

    this._router.put('/lobby', this.putOpenLobby);
    this._router.delete('/lobby', this.putCloseLobby);

    this._router.put('/lobby/member', this.addMember);
    this._router.delete('/lobby/:quizName/member/:nickname', this.deleteMember);

    this._router.post('/quiz/upload', this.uploadQuiz);
    this._router.post('/quiz/start', this.startQuiz);
    this._router.get('/quiz/startTime/:quizName', this.getQuizStartTime);
    this._router.post('/quiz/settings/update', this.updateQuizSettings);
    this._router.patch('/quiz/reset/:quizName', this.resetQuiz);
    this._router.post('/quiz/reserve', this.reserveQuiz);
    this._router.delete('/quiz', this.deleteQuiz);
    this._router.delete('/quiz/active', this.deleteActiveQuiz);

    this._router.get('/quiz/member/:quizName', this.getAllMembers);
    this._router.get('/quiz/member/:quizName/available', this.getRemainingNicks);
    this._router.put('/quiz/member/response', this.addMemberResponse);
    this._router.put('/quiz/member/confidence-rate', this.setMemberConfidenceRate);
    this._router.put('/quiz/member/reading-confirmation', this.setMemberReadingConfirmation);

    this._router.get('/quiz/export/:quizName/:privateKey/:theme/:language', this.getExportFile);

    this._router.get('/files/:directory/:subdirectory/:fileName', this.getFileByName);
  }

}

// Create the ApiRouter, and export its configured Express.Router
const apiRoutes: ApiRouter = new ApiRouter();

export default apiRoutes.router;
