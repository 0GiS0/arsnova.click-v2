import {Component, OnDestroy, OnInit} from '@angular/core';
import {FooterBarService} from '../../../service/footer-bar.service';
import {ActiveQuestionGroupService} from 'app/service/active-question-group.service';
import {TranslateService} from '@ngx-translate/core';
import {Headers, Http, RequestOptions, RequestOptionsArgs} from '@angular/http';
import {DefaultSettings} from '../../../service/settings.service';

@Component({
  selector: 'app-nickname-manager',
  templateUrl: './nickname-manager.component.html',
  styleUrls: ['./nickname-manager.component.scss']
})
export class NicknameManagerComponent implements OnInit, OnDestroy {
  get selectedCategory(): string {
    return this._selectedCategory;
  }

  get availableNicks() {
    return this._availableNicks;
  }

  private _apiEndPoint = `${DefaultSettings.httpApiEndpoint}/availableNicks/all`;
  private _availableNicks = {};
  private _selectedCategory = '';

  constructor(
    private activeQuestionGroupService: ActiveQuestionGroupService,
    private translateService: TranslateService,
    private footerBarService: FooterBarService,
    private http: Http) {
    this.footerBarService.replaceFooterElements([
      this.footerBarService.footerElemBack,
      this.footerBarService.footerElemBlockRudeNicknames,
      this.footerBarService.footerElemEnableCasLogin
    ]);
  }

  availableNickCategories(): Array<string> {
    return Object.keys(this._availableNicks);
  }

  toggleSelectedCategory(name: string): void {
    this._selectedCategory = this._selectedCategory === name ? '' : name;
  }

  selectNick(name: string): void {
    this.activeQuestionGroupService.activeQuestionGroup.sessionConfig.nicks.toggleSelectedNick(name);
  }

  hasSelectedNick(name: string): boolean {
    return this.activeQuestionGroupService.activeQuestionGroup.sessionConfig.nicks.hasSelectedNick(name);
  }

  hasSelectedCategory(category?: string): boolean {
    return category ? category === this._selectedCategory : !!this._selectedCategory;
  }

  hasSelectedAllNicks(): boolean {
    const selectedNicks = this.activeQuestionGroupService.activeQuestionGroup.sessionConfig.nicks.selectedNicks;
    const filteredNicksLength = this._availableNicks[this._selectedCategory].filter(elem => {
      return selectedNicks.indexOf(elem) > -1;
    }).length;
    return filteredNicksLength === this._availableNicks[this._selectedCategory].length;
  }

  getNumberOfSelectedNicksOfCategory(category: string): number {
    const selectedNicks = this.activeQuestionGroupService.activeQuestionGroup.sessionConfig.nicks.selectedNicks;
    return this._availableNicks[category].filter(elem => {
      return selectedNicks.indexOf(elem) > -1;
    }).length;
  }

  getNumberOfAvailableNicksForCategory(category: string): number {
    return this._availableNicks[category].length;
  }

  toggleAllNicks(): void {
    if (this.hasSelectedAllNicks()) {
      this._availableNicks[this._selectedCategory].forEach(elem => {
        this.activeQuestionGroupService.activeQuestionGroup.sessionConfig.nicks.removeSelectedNickByName(elem);
      });
    } else {
      this._availableNicks[this._selectedCategory].forEach(elem => {
        this.activeQuestionGroupService.activeQuestionGroup.sessionConfig.nicks.addSelectedNick(elem);
      });
    }
  }

  ngOnInit() {
    const headers = new Headers();
    headers.append('Content-Type', 'multipart/form-data');
    headers.append('Accept', 'application/json');
    const options = new RequestOptions(<RequestOptionsArgs>headers);
    this.http.get(`${this._apiEndPoint}`, options)
        .map(res => res.json())
        .subscribe(
          data => {
            this._availableNicks = data;
          },
          error => {
            console.log(error);
          }
        );
  }

  ngOnDestroy() {
    this.activeQuestionGroupService.persist();
  }

}
