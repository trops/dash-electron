/**
 * Template Widget
 *
 * I'm a Widget.
 * I can be placed directly into the layout.
 * - my props are very interesting! If you configure userConfig, the keys will be the prop names and you can access them.
 *
 * @package Template
 */
import { Widget, Heading2, SubHeading3, Panel } from "@trops/dash-react";

export const TemplateWidget = ({
    id,
    title = "Hello",
    subtitle = "Im a widget.",
    listeners,
    uuid,
    ...props
}) => {
    /*
  // WidgetApi
  // Required to publish events, among other things
  const { widgetApi } = useContext(DashboardContext);

  // myPublishFunction
  // You can define this function to send data to other Widgets that are subscribed
  // You may setup the subscriptions in the Dashboard interface
  // - Dont forget to configure the events that you publish in the Template.dash file

  function publishItem(data) {
    if (widgetApi) {
      // submit the event
      widgetApi.publishEvent(`TemplateWidget[${id}].myPublishEvent`, {
        data,
      });
    }
  }
  */

    /*
   // IMPORTANT!!
   // handler map to pass to the registration of listeners
  const handlers = {
    nameOfLister: myEventHandler,
  };

  // register our listeners (from our config, and injected into this widget)
  useEffect(() => {
    if (listeners !== null && handlers && widgetApi !== null) {
      widgetApi.registerListeners(listeners, handlers, uuid);
    }
  }, [listeners, props]);

  // /**
  //  * handleEvent
  //  *
  //  * @param {object} data
  //  */
    // function handleSaveDataComplete(data) {
    //   if (data) {
    //     console.log("save data complete ", data);
    //     readData(filename);
    //   }
    // }

    {
        /* Note: We are using the Dashboard components (themed for your pleasure) to build this Widget render, you can use whatever you want! */
    }

    return (
        <Widget {...props} width={"w-full"} height={"h-full"}>
            <Panel>
                <Heading2 title={title} />
                <SubHeading3 title={subtitle} />
            </Panel>
        </Widget>
    );
};
