import {IQuestionGroup} from '../interfaces/questions/interfaces';
import {WebSocketRouter} from '../routes/websocket';
import * as WebSocket from 'ws';

const activeQuizzes: Object = {};

export declare interface INickname {
  id: number;
  name: string;
  colorCode: string;
  webSocket: number;

  serialize(): Object;
}

class Member implements INickname {
  set webSocket(value: number) {
    this._webSocket = value;
  }

  get id(): number {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get colorCode(): string {
    return this._colorCode;
  }

  get webSocket(): number {
    return this._webSocket;
  }

  private _id: number;
  private _name: string;
  private _colorCode: string;
  private _webSocket: number;

  constructor({id, name, colorCode}: { id: number, name: string, colorCode: string }) {
    this._id = id;
    this._name = name;
    this._colorCode = colorCode;
  }

  public serialize(): Object {
    return {
      id: this.id,
      name: this.name,
      colorCode: this.colorCode
    };
  }
}

export declare interface IActiveQuiz {
  name: string;
  nicknames: Array<INickname>;
  currentQuestionIndex: number;
  originalObject: IQuestionGroup;

  addMember(name: string, webSocketId: number): boolean;

  removeMember(name: string): boolean;

  onDestroy(): void;
}

class ActiveQuizItem implements IActiveQuiz {
  set currentQuestionIndex(value: number) {
    this._currentQuestionIndex = value;
  }

  get webSocketRouter(): WebSocketRouter {
    return this._webSocketRouter;
  }

  get originalObject(): IQuestionGroup {
    return this._originalObject;
  }

  get currentQuestionIndex(): number {
    return this._currentQuestionIndex;
  }

  get nicknames(): Array<INickname> {
    return this._nicknames;
  }

  get name(): string {
    return this._name;
  }

  private _name: string;
  private _nicknames: Array<INickname>;
  private _currentQuestionIndex: number = 0;
  private _originalObject: IQuestionGroup;
  private _webSocketRouter: WebSocketRouter;

  constructor({nicknames, originalObject}: { nicknames: Array<INickname>, originalObject: IQuestionGroup }) {
    this._name = originalObject.hashtag;
    this._nicknames = nicknames;
    this._originalObject = originalObject;
    this._webSocketRouter = new WebSocketRouter(this);
  }

  public onDestroy(): void {
    this.webSocketRouter.pushMessageToClients({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:DELETED',
      payload: {}
    });
  }

  public nextQuestion(): number {
    if (this.currentQuestionIndex < this.originalObject.questionList.length - 1) {
      this.currentQuestionIndex++;
      this.webSocketRouter.pushMessageToClients({
        status: 'STATUS:SUCCESSFUL',
        step: 'QUIZ:NEXT_QUESTION',
        payload: {
          question: this.originalObject.questionList[this.currentQuestionIndex]
        }
      });
      return this.currentQuestionIndex;
    } else {
      return -1;
    }
  }

  public findMemberByName(name: string): Array<INickname> {
    return this.nicknames.filter((nicks) => {
      return nicks.name === name;
    });
  }

  private generateRandomColorCode(): string {
    return 'blue';
  }

  public addMember(name: string, webSocketId: number): boolean {
    const foundMembers: number = this.findMemberByName(name).length;
    if (foundMembers === 0) {
      const member: INickname = new Member({id: this.nicknames.length, name, colorCode: this.generateRandomColorCode()});
      member.webSocket = webSocketId;
      this.nicknames.push(member);
      this.webSocketRouter.pushMessageToClients({
        status: 'STATUS:SUCCESSFUL',
        step: 'MEMBER:ADDED',
        payload: {member: member.serialize()}
      });
      return true;
    }
    return false;
  }

  public removeMember(name: string): boolean {
    const foundMembers: Array<INickname> = this.findMemberByName(name);
    if (foundMembers.length === 1) {
      this.nicknames.splice(this.nicknames.indexOf(foundMembers[0]), 1);
      this.webSocketRouter.pushMessageToClients({
        status: 'STATUS:SUCCESSFUL',
        step: 'MEMBER:REMOVED',
        payload: {
          name: name
        }
      });
      return true;
    }
    return false;
  }
}

export default class QuizManagerDAO {
  get instance(): QuizManagerDAO {
    return this._instance;
  }

  private _instance: QuizManagerDAO = this;

  public static initActiveQuiz(quiz: IQuestionGroup): void {
    if (activeQuizzes[quiz.hashtag]) {
      return;
    }
    QuizManagerDAO.convertLegacyQuiz(quiz);
    activeQuizzes[quiz.hashtag] = new ActiveQuizItem({nicknames: [], originalObject: quiz});
  }
  public static removeActiveQuiz(name: string): boolean {
    delete activeQuizzes[name];
    return typeof activeQuizzes[name] === 'undefined';
  }
  public static getActiveQuizByName(name: string): IActiveQuiz {
    return activeQuizzes[name];
  }
  public static updateActiveQuiz(data: IActiveQuiz): void {
    activeQuizzes[data.originalObject.hashtag] = data;
  }
  public static getAllActiveQuizzes(): Object {
    return activeQuizzes;
  }
  public static getAllActiveMembers(): number {
    return Object.keys(activeQuizzes).filter((value: string) => {
      return activeQuizzes[value].nicknames.length;
    }).reduce((a: number, b: string) => parseInt(a + activeQuizzes[b].nicknames.length, 10), 0);
  }
  public static getAllActiveDemoQuizzes(): String[] {
    return Object.keys(activeQuizzes).filter((value: string) => {
      return activeQuizzes[value].name.toLowerCase().startsWith('demo quiz');
    });
  }
  public static convertLegacyQuiz(legacyQuiz: any): void {
    if (legacyQuiz.hasOwnProperty('configuration')) {
      // Detected old v1 arsnova.click quiz
      legacyQuiz.sessionConfig = {
        music: {
          titleConfig: {
            lobby: legacyQuiz.configuration.music.lobbyTitle,
            countdownRunning: legacyQuiz.configuration.music.countdownRunningTitle,
            countdownEnd: legacyQuiz.configuration.music.countdownEndTitle
          },
          volumeConfig: {
            global: legacyQuiz.configuration.music.lobbyVolume,
            lobby: legacyQuiz.configuration.music.lobbyVolume,
            countdownRunning: legacyQuiz.configuration.music.countdownRunningVolume,
            countdownEnd: legacyQuiz.configuration.music.countdownEndVolume,
            useGlobalVolume: legacyQuiz.configuration.music.isUsingGlobalVolume,
          },
          lobbyEnabled: legacyQuiz.configuration.music.lobbyEnabled,
          countdownRunningEnabled: legacyQuiz.configuration.music.countdownRunningEnabled,
          countdownEndEnabled: legacyQuiz.configuration.music.countdownEndEnabled
        },
        nicks: {
          selectedNicks: legacyQuiz.configuration.nicks.selectedValues,
          blockIllegalNicks: legacyQuiz.configuration.nicks.blockIllegal,
          restrictToCasLogin: legacyQuiz.configuration.nicks.restrictToCASLogin
        },
        theme: legacyQuiz.configuration.theme,
        readingConfirmationEnabled: legacyQuiz.configuration.readingConfirmationEnabled,
        showResponseProgress: legacyQuiz.configuration.showResponseProgress,
        confidenceSliderEnabled: legacyQuiz.configuration.confidenceSliderEnabled
      };
      delete legacyQuiz.configuration;
    }
  }
}
