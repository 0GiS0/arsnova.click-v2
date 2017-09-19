import {Component, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs/Subscription';
import {ActiveQuestionGroupService} from '../../../service/active-question-group.service';
import {TranslateService} from '@ngx-translate/core';
import {FooterBarService} from '../../../service/footer-bar.service';
import {FooterBarComponent} from '../../../footer/footer-bar/footer-bar.component';
import {ActivatedRoute} from '@angular/router';
import {IQuestion} from '../../../../lib/questions/interfaces';

@Component({
  selector: 'app-countdown',
  templateUrl: './countdown.component.html',
  styleUrls: ['./countdown.component.scss']
})
export class CountdownComponent implements OnInit, OnDestroy {
  get parsedSeconds(): string {
    return this._parsedSeconds;
  }

  get parsedMinutes(): string {
    return this._parsedMinutes;
  }

  get parsedHours(): string {
    return this._parsedHours;
  }

  get countdown(): number {
    return this._countdown;
  }

  private _questionIndex: number;
  private _question: IQuestion;
  private _routerSubscription: Subscription;
  private _parsedHours: string = '0';
  private _parsedMinutes: string = '0';
  private _parsedSeconds: string = '0';

  public minCountdownValue: number = 10;
  private _countdown: number = this.minCountdownValue;

  constructor(private activeQuestionGroupService: ActiveQuestionGroupService,
              private translateService: TranslateService,
              private route: ActivatedRoute,
              private footerBarService: FooterBarService) {
    this.footerBarService.replaceFooterElments([
      FooterBarComponent.footerElemBack,
      FooterBarComponent.footerElemNicknames
    ]);
  }

  updateCountdown(value: string): void {
    this._countdown = parseInt(value);
    const hours = Math.floor(this._countdown / 3600);
    const minutes = Math.floor((this._countdown - hours * 3600) / 60);
    const seconds = Math.floor((this._countdown - hours * 3600) - (minutes * 60));

    this._parsedHours = hours > 0 && hours < 10 ? '0' + hours : String(hours);
    this._parsedMinutes = minutes > 0 && minutes < 10 ? '0' + minutes : String(minutes);
    this._parsedSeconds = seconds > 0 && seconds < 10 ? '0' + seconds : String(seconds);

    this.activeQuestionGroupService.activeQuestionGroup.questionList[this._questionIndex].timer = this.countdown;
  }

  ngOnInit() {
    this._routerSubscription = this.route.params.subscribe(params => {
      this._questionIndex = +params['questionIndex'];
      this._question = this.activeQuestionGroupService.activeQuestionGroup.questionList[this._questionIndex];
      this.updateCountdown(String(this._question.timer));
    });
  }

  ngOnDestroy() {
    this.activeQuestionGroupService.persist();
    this._routerSubscription.unsubscribe();
  }

}
