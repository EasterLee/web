// particle.vert
attribute vec2 aPosition;
attribute vec3 aColor;

varying vec3 vColor;

void main() {
    vColor = aColor;
    gl_Position = vec4(aPosition, 0.0, 1.0);
    gl_PointSize = 10.0;
}