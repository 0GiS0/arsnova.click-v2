import {Component, OnDestroy, OnInit} from '@angular/core';
import {ConnectionService} from '../../../service/connection.service';
import {IMessage} from '../quiz-lobby/quiz-lobby.component';
import {DefaultSettings} from '../../../service/settings.service';
import {Router} from '@angular/router';
import {HttpClient} from '@angular/common/http';
import {CurrentQuizService} from '../../../service/current-quiz.service';
import {Subscription} from 'rxjs/Subscription';
import {AttendeeService} from '../../../service/attendee.service';
import {FooterBarService} from '../../../service/footer-bar.service';
import {QuestionTextService} from '../../../service/question-text.service';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';

@Component({
  selector: 'app-reading-confirmation',
  templateUrl: './reading-confirmation.component.html',
  styleUrls: ['./reading-confirmation.component.scss']
})
export class ReadingConfirmationComponent implements OnInit, OnDestroy {

  public questionIndex: number;
  public questionText: string;

  constructor(
    private connectionService: ConnectionService,
    private attendeeService: AttendeeService,
    private router: Router,
    private http: HttpClient,
    private currentQuizService: CurrentQuizService,
    private questionTextService: QuestionTextService,
    private sanitizer: DomSanitizer,
    private footerBarService: FooterBarService
  ) {
    this.questionIndex = currentQuizService.previousQuestions.length;
    this.footerBarService.replaceFooterElements([]);
  }

  public normalizeAnswerOptionIndex(index: number): string {
    return String.fromCharCode(65 + index);
  }

  public sanitizeHTML(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(`${value}`);
  }

  ngOnInit() {
    this.connectionService.authorizeWebSocket(this.currentQuizService.hashtag);
    this.handleMessages();
    this.questionTextService.getEmitter().subscribe((value: string) => {
      this.questionText = value;
    });
    this.questionTextService.change(this.currentQuizService.currentQuestion.questionText);
  }

  ngOnDestroy() {
  }

  confirmReading() {
    this.http.put(`${DefaultSettings.httpApiEndpoint}/lobby/member/reading-confirmation`, {
      quizName: this.currentQuizService.hashtag,
      nickname: window.sessionStorage.getItem(`${this.currentQuizService.hashtag}_nick`),
      questionIndex: this.questionIndex
    }).subscribe(
      (data: IMessage) => {
        this.router.navigate(['/quiz', 'flow', 'results']);
      }
    );
  }

  private handleMessages() {
    this.connectionService.socket.subscribe((data: IMessage) => {
      switch (data.step) {
        case 'QUIZ:START':
          this.router.navigate(['/quiz', 'flow', 'voting']);
          break;
        case 'MEMBER:UPDATED_RESPONSE':
          console.log('modify response data for nickname in reading confirmation view', data.payload.nickname);
          this.attendeeService.modifyResponse(data.payload.nickname);
          break;
        case 'QUIZ:RESET':
          this.attendeeService.clearResponses();
          this.router.navigate(['/quiz', 'flow', 'lobby']);
          break;
      }
    });
  }

}
