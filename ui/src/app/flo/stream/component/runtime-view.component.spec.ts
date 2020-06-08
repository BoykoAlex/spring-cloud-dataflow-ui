import { ApplicationRef, ComponentFactoryResolver } from '@angular/core';
import { async, ComponentFixture, inject, TestBed } from '@angular/core/testing';
import { dia } from 'jointjs';
import { RuntimeStreamFloViewComponent } from './runtime-view.component';
import { MetamodelService } from '../metamodel.service';
import { MockSharedAppService } from '../../../tests/service/app.service.mock';
import { StreamsModule } from '../../../streams/streams.module';
import { RenderService } from '../render.service';
import { Stream } from '../../../shared/model/stream.model';
import { TYPE_INSTANCE_DOT, TYPE_INSTANCE_LABEL } from '../support/shapes';
import { AppStatus, StreamStatus } from '../../../shared/model/metrics.model';

/**
 * Test {@link StreamGraphDefinitionComponent}.
 *
 * @author Alex Boyko
 */
describe('RuntimeStreamFloViewComponent', () => {
  let component: RuntimeStreamFloViewComponent;
  let fixture: ComponentFixture<RuntimeStreamFloViewComponent>;
  const metamodelService = new MetamodelService(new MockSharedAppService());

  let applicationRef: ApplicationRef;
  let resolver: ComponentFactoryResolver;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        StreamsModule
      ],
    });
  }));

  beforeEach(
    inject(
      [
        ApplicationRef,
        ComponentFactoryResolver
      ],
      (
        _applicationRef: ApplicationRef,
        _resolver: ComponentFactoryResolver
      ) => {
        applicationRef = _applicationRef;
        resolver = _resolver;
      }
    )
  );

  beforeEach(() => {
    fixture = TestBed.createComponent(RuntimeStreamFloViewComponent);
    component = fixture.componentInstance;
    fixture.componentInstance.metamodel = metamodelService;
    fixture.componentInstance.renderer = new RenderService(metamodelService, resolver,
      fixture.debugElement.injector, applicationRef);
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
    expect(component.dsl).toBeUndefined();
    expect(component.flo).toBeDefined();
  });

  it('check empty read-only view', () => {
    expect(component.flo.noPalette).toBeTruthy();
    expect(component.flo.readOnlyCanvas).toBeTruthy();
    expect(component.flo.getGraph().getCells().length).toEqual(0);
  });

  it('check stream in the view', (done) => {
    component.stream = Stream.parse({
      streamName: 'test-stream',
      dslText: 'http | filter | null',
      originalDslText: 'http | filter | null',
      description: 'demo description',
      status: 'deployed'
    });
    const subscription = component.flo.textToGraphConversionObservable.subscribe(() => {
      subscription.unsubscribe();
      expect(component.flo.getGraph().getElements().length).toEqual(3);
      expect(component.flo.getGraph().getLinks().length).toEqual(2);
      done();
    });
    // Subscribe to graph changes before running angular change/update cycle
    fixture.detectChanges();
  });

  it('verify dots in the view', (done) => {
    component.stream = Stream.parse({
      streamName: 'test-stream',
      dslText: 'http | filter | null',
      originalDslText: 'http | filter | null',
      description: 'demo description',
      status: 'deployed'
    });

    const httpMetrics = createStreamStatus('source', 'http', 2);
    const filterMetrics = createStreamStatus('processor', 'filter', 60);
    const nullMetrics = createStreamStatus('sink', 'null', 3);

    // Remove 3 instances to have 57/60 label
    filterMetrics.instances.pop();
    filterMetrics.instances.pop();
    filterMetrics.instances.pop();

    const streamMetrics = new StreamStatus;
    streamMetrics.name = 'test-stream';
    streamMetrics.applications = [
      httpMetrics,
      filterMetrics,
      nullMetrics
    ];
    component.metrics = streamMetrics;

    const subscription = component.flo.textToGraphConversionObservable.subscribe(() => {
      subscription.unsubscribe();

      // verify http dots
      const http = <dia.Element> component.flo.getGraph().getElements().find(e => e.attr('metadata/name') === 'http');
      expect(http).toBeDefined();
      const httpEmbeds = http.getEmbeddedCells().filter(c => c.get('type') === TYPE_INSTANCE_DOT);
      expect(http.getEmbeddedCells().find(c => c.get('type') === TYPE_INSTANCE_LABEL)).toBeUndefined();
      expect(httpEmbeds.length).toEqual(2);
      httpMetrics.instances.forEach((instance, i) => expect(httpEmbeds[i].attr('instance')).toEqual(instance));

      // verify filter label
      const filter = <dia.Element> component.flo.getGraph().getElements().find(e => e.attr('metadata/name') === 'filter');
      expect(filter).toBeDefined();
      expect(filter.getEmbeddedCells().find(c => c.get('type') === TYPE_INSTANCE_DOT)).toBeUndefined();
      const filterEmbeds = filter.getEmbeddedCells().filter(c => c.get('type') === TYPE_INSTANCE_LABEL);
      expect(filterEmbeds.length).toEqual(1);
      expect(filterEmbeds[0].attr('.label/text')).toEqual('57/57');

      // verify null dots
      const nullApp = <dia.Element> component.flo.getGraph().getElements().find(e => e.attr('metadata/name') === 'null');
      expect(nullApp).toBeDefined();
      const nullEmbeds = nullApp.getEmbeddedCells().filter(c => c.get('type') === TYPE_INSTANCE_DOT);
      expect(nullApp.getEmbeddedCells().find(c => c.get('type') === TYPE_INSTANCE_LABEL)).toBeUndefined();
      expect(nullEmbeds.length).toEqual(3);
      nullMetrics.instances.forEach((instance, i) => expect(nullEmbeds[i].attr('instance')).toEqual(instance));

      done();

    });
    // Subscribe to graph changes before running angular change/update cycle
    fixture.detectChanges();
  });

  function createStreamStatus(group: string, name: string, numberOfInstances: number): AppStatus {
    const instances = [];
    for (let index = 0; index < numberOfInstances; index++) {
      instances.push({
        guid: `${name}-${index}`,
        index: index,
        status: 'deployed'
      });
    }
    return AppStatus.parse({
      deploymentId: `${name}-${group}`,
      state: 'deployed',
      name: name,
      instances: {
        _embedded: {
          appInstanceStatusResourceList: instances
        }
      }
    });
  }

});