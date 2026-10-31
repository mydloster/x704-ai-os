package sk.x704.aiassistant;

/** A transparent placeholder, intentionally not presented as a language model. */
final class DemoAssistant {
    private DemoAssistant() {}
    static String reply(String text) {
        return "Ukážková odpoveď: prijal som správu (" + text.length() + " znakov). "
            + "Cloudový poskytovateľ zatiaľ nie je zapojený. "
            + "Ďalšia verzia bude komunikovať cez overený server; API kľúč nebude v aplikácii.";
    }
}
