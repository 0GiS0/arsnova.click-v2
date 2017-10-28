import {Component, OnInit} from '@angular/core';
import {FooterBarService} from '../../service/footer-bar.service';
import {TranslateService} from '@ngx-translate/core';
import {HeaderLabelService} from '../../service/header-label.service';

@Component({
  selector: 'app-theme-switcher',
  templateUrl: './theme-switcher.component.html',
  styleUrls: ['./theme-switcher.component.scss']
})
export class ThemeSwitcherComponent implements OnInit {

  private previewThemeBackup: string;

  constructor(
    private footerBarService: FooterBarService,
    private translateService: TranslateService,
    private headerLabelService: HeaderLabelService) {
    footerBarService.replaceFooterElements([
      this.footerBarService.footerElemHome,
      this.footerBarService.footerElemAbout,
      this.footerBarService.footerElemTranslation,
      this.footerBarService.footerElemFullscreen,
      this.footerBarService.footerElemHashtagManagement,
      this.footerBarService.footerElemImport,
    ]);
    headerLabelService.setHeaderLabel('component.theme_switcher.set_theme');
    this.previewThemeBackup = document.getElementsByTagName('body')[0].className;
  }

  ngOnInit() {
  }

  updateTheme(id: string) {
    document.getElementsByTagName('body')[0].className = id;
    this.previewThemeBackup = document.getElementsByTagName('body')[0].className;
    window.localStorage.setItem('config.default_theme', this.previewThemeBackup);
  }

  previewTheme(id) {
    document.getElementsByTagName('body')[0].className = id;
  }

  restoreTheme() {
    document.getElementsByTagName('body')[0].className = this.previewThemeBackup;
  }

}
