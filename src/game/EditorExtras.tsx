import { Grid, GizmoHelper, GizmoViewport } from '@react-three/drei'

/** Editor viewport chrome: ground grid + corner view-cube. */
export function EditorChrome() {
  return (
    <>
      <Grid
        position={[0, 0.02, 0]}
        args={[90, 70]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#3a4046"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#4f6b52"
        fadeDistance={120}
        fadeStrength={1}
      />
      <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
        <GizmoViewport axisColors={['#c2554f', '#7da353', '#4f7ac2']} labelColor="#e8e8e8" />
      </GizmoHelper>
    </>
  )
}
