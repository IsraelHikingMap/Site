import { Component, OnInit, Type } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ScrollToConfigOptionsTarget } from "./scroll-to-config.interface";
import { ScrollToModule } from "./scroll-to.module";
import { ScrollToDirective } from "./scroll-to.directive";
import { ScrollToService } from "./scroll-to.service";
import { DEFAULTS, EVENTS } from "./scroll-to-helpers";
import { ScrollToEvent } from "./scroll-to-event.interface";

const TARGET = "destination";
const BUTTON_ID = "btn-1";

interface CompileTemplateConfigOptions extends ScrollToConfigOptionsTarget {
  action?: string;
}

class ScrollToServiceMock {
  scrollTo() { }
}

/** Dummy Component for testing the Angular Directive */
@Component({
  selector: "ngx-scroll-to",
  styles: [`
    #destination {
    margin-top: 100vh;
    }
  `],
  template: `
    <button id="${BUTTON_ID}" [ngxScrollTo]="'${TARGET}'">Go to destination</button>
    <div id="${TARGET}">You've reached your destination</div>
  `
})
export class DummyComponent implements OnInit {

  constructor() { }

  ngOnInit() { }
}

const createTestComponent = (
  component: Type<any>,
  config: CompileTemplateConfigOptions,
  event: ScrollToEvent): ComponentFixture<any> => {

  const template = `
    <button id="${BUTTON_ID}" 
      [ngxScrollTo]="'${config.target}'"
      ${event ? "[ngxScrollToEvent]=\"'" + event + "'\"" : ""}
      >Go to destination</button>
    <div id="${config.target}">You've reached your destination</div>
`;

  TestBed.overrideComponent(component, {
    set: {
      template
    }
  });

  return TestBed.createComponent(component);
};

describe("ScrollToDirective", () => {

  beforeEach(() => {
    TestBed.configureTestingModule({
        imports: [ScrollToModule.forRoot()],
        declarations: [DummyComponent],
        providers: [{provide: ScrollToService, useClass: ScrollToServiceMock}]
      });
  });

  it("should be created", () => {
    const fixture = TestBed.createComponent(DummyComponent);
    const directive = fixture.debugElement.query(By.directive(ScrollToDirective));
    expect(directive).toBeTruthy();
  });

  it("should have default values", fakeAsync(() => {

    const fixture: ComponentFixture<DummyComponent> = TestBed.createComponent(DummyComponent);
    const service: ScrollToService = TestBed.inject(ScrollToService);
    const component: DummyComponent = fixture.componentInstance;

    component.ngOnInit();

    fixture.detectChanges();

    spyOn(service, "scrollTo");

    const btn = fixture.debugElement.query(By.css(`#${BUTTON_ID}`));

    btn.triggerEventHandler("click", null);
    tick();

    expect(service.scrollTo).toHaveBeenCalledWith({
      target: TARGET,
      duration: DEFAULTS.duration,
      easing: DEFAULTS.easing,
      offset: DEFAULTS.offset,
      offsetMap: DEFAULTS.offsetMap
    });

  }));

  EVENTS.forEach((event: string) => {
    it(`should handle a '${event}' event`, fakeAsync(() => {

      const templateConfig: CompileTemplateConfigOptions = {
        target: TARGET
      };

      const fixture: ComponentFixture<DummyComponent> = createTestComponent(DummyComponent, templateConfig, event as ScrollToEvent);
      const service: ScrollToService = TestBed.inject(ScrollToService);
      const component: DummyComponent = fixture.componentInstance;

      component.ngOnInit();

      fixture.detectChanges();
      spyOn(service, "scrollTo");

      const btn = fixture.debugElement.query(By.css(`#${BUTTON_ID}`));

      btn.triggerEventHandler(event, null);
      tick();

      expect(service.scrollTo).toHaveBeenCalledTimes(1);
      expect(service.scrollTo).toHaveBeenCalledWith({
        target: TARGET,
        duration: DEFAULTS.duration,
        easing: DEFAULTS.easing,
        offset: DEFAULTS.offset,
        offsetMap: DEFAULTS.offsetMap
      });

    }));
  });
});
