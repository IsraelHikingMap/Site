# Stack traces from play console are only readable through the mapping file that is built
# alongside the bundle, and only if the line numbers survive to be mapped back. The source file
# names are renamed rather than kept, so they carry nothing but the line number.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Capacitor asks a plugin class for its @CapacitorPlugin annotation to learn which permissions the
# plugin declares, and does not check the answer, so a plugin it cannot read the annotation off
# takes the app down with a null pointer the first time anything asks after a permission - for
# background geolocation that is during startup, and for the camera the moment a photo is taken.
# Letting R8 rename the annotation types is what breaks the lookup; keeping them fixes it, verified
# by building it both ways and watching the app come up or die on a device.
-keep @interface com.getcapacitor.**
