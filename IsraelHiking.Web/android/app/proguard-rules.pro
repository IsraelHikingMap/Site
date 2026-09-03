# Stack traces from play console are only readable through the mapping file that is built
# alongside the bundle, and only if the line numbers survive to be mapped back. The source file
# names are renamed rather than kept, so they carry nothing but the line number.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# The camera plugin carries its parameters and its results between the app and the editor as gson
# objects, and neither gson nor the ioncamera-android library that uses it ships rules of its own.
# Gson works over these classes by reflection: it needs the fields to still be there to fill them,
# the @SerializedName on each one to know which json key it answers to, and the generic signature
# of a TypeToken to know what it is building - none of which R8 can see is used. These are gson's
# own documented rules.
-keepattributes Signature
-dontwarn sun.misc.**
-keepclassmembers,allowobfuscation class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-keep,allowobfuscation,allowshrinking class com.google.gson.reflect.TypeToken
-keep,allowobfuscation,allowshrinking class * extends com.google.gson.reflect.TypeToken
-keep class * extends com.google.gson.TypeAdapter
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# Capacitor asks a plugin class for its @CapacitorPlugin annotation at runtime to learn which
# permissions the plugin declares. It does not check the answer, so a plugin whose annotation did
# not survive takes the app down with a null pointer the first time it asks after a permission -
# for background geolocation that is during startup. An annotation is only written into the dex if
# something asks for it to be kept, and the annotation types themselves have to stay as well.
-keepattributes RuntimeVisibleAnnotations,RuntimeVisibleParameterAnnotations,AnnotationDefault
-keep @interface com.getcapacitor.**
-keep @interface com.getcapacitor.annotation.**
-keep,allowobfuscation @interface * { *; }
